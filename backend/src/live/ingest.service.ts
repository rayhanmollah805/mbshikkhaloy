import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import type { Server } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { PrismaService } from '../prisma/prisma.service.js';

const MAX_STREAMS = Number(process.env.LIVE_MAX_STREAMS) || 2;
const VIDEO_KBPS = Number(process.env.LIVE_VIDEO_KBPS) || 2500;
const TICKET_TTL_MS = 60_000;
const MAX_QUEUE_BYTES = 32 * 1024 * 1024;

type Session = { ws: WebSocket; ff: ChildProcess; startedAt: number };

/**
 * Browser -> WebSocket (MediaRecorder webm chunks) -> ffmpeg -> RTMP -> YouTube.
 * The stream key stays on the server; the browser only holds a one-time ticket.
 */
@Injectable()
export class IngestService {
  private readonly log = new Logger('Ingest');
  private readonly tickets = new Map<string, { liveId: string; exp: number }>();
  private readonly sessions = new Map<string, Session>();

  constructor(private readonly prisma: PrismaService) {}

  issueTicket(liveId: string) {
    const now = Date.now();
    for (const [k, v] of this.tickets) if (v.exp < now) this.tickets.delete(k);
    const t = randomBytes(24).toString('hex');
    this.tickets.set(t, { liveId, exp: now + TICKET_TTL_MS });
    return t;
  }

  isStreaming(liveId: string) {
    return this.sessions.has(liveId);
  }

  stop(liveId: string) {
    const s = this.sessions.get(liveId);
    if (!s) return;
    this.sessions.delete(liveId);
    try {
      s.ws.close(1000, 'stopped');
    } catch {
      /* already closed */
    }
    s.ff.stdin?.end();
    setTimeout(() => s.ff.kill('SIGKILL'), 4000).unref();
  }

  /** Hooks the WebSocket upgrade for /api/live/:id/ingest onto the Nest HTTP server. */
  attach(server: Server) {
    const wss = new WebSocketServer({ noServer: true, maxPayload: 8 * 1024 * 1024 });
    server.on('upgrade', (req, socket, head) => {
      const url = new URL(req.url ?? '/', 'http://x');
      const m = url.pathname.match(/^\/api\/live\/([^/]+)\/ingest$/);
      const ticket = url.searchParams.get('t') ?? '';
      const tk = this.tickets.get(ticket);
      this.tickets.delete(ticket); // one-time
      if (!m || !tk || tk.exp < Date.now() || tk.liveId !== m[1]) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        return socket.destroy();
      }
      wss.handleUpgrade(req, socket, head, (ws) => void this.onConnection(ws, m[1]));
    });
  }

  private async onConnection(ws: WebSocket, liveId: string) {
    const send = (o: object) => ws.readyState === ws.OPEN && ws.send(JSON.stringify(o));
    const row = await this.prisma.liveClass.findUnique({ where: { id: liveId } });
    if (!row?.ingestUrl || !row.streamKey) {
      send({ type: 'error', message: 'এই ক্লাসে YouTube স্ট্রিম সেট করা নেই' });
      return ws.close();
    }
    // A reconnect from the same teacher replaces the old pipe.
    this.stop(liveId);
    if (this.sessions.size >= MAX_STREAMS) {
      send({ type: 'error', message: 'সার্ভারে একসাথে সর্বোচ্চ লাইভ চলছে, একটু পরে চেষ্টা করুন' });
      return ws.close();
    }

    const ff = spawn(process.env.FFMPEG_BIN || 'ffmpeg', this.args(`${row.ingestUrl}/${row.streamKey}`), {
      stdio: ['pipe', 'ignore', 'pipe'],
    });
    const s: Session = { ws, ff, startedAt: Date.now() };
    this.sessions.set(liveId, s);
    let tail = '';
    ff.stderr?.on('data', (d) => (tail = (tail + d).slice(-1500)));
    ff.stdin?.on('error', () => undefined);
    ff.on('error', (e) => {
      this.log.error(`ffmpeg spawn failed: ${e.message}`);
      send({ type: 'error', message: 'ffmpeg চালু করা যায়নি' });
    });
    ff.on('close', (code) => {
      if (this.sessions.get(liveId) === s) this.sessions.delete(liveId);
      // The key is in ffmpeg's messages on some failures; never forward or log it.
      const safe = tail.split(row.streamKey!).join('***');
      this.log.log(`ffmpeg exit=${code} live=${liveId} after ${Math.round((Date.now() - s.startedAt) / 1000)}s ${code ? safe.slice(-300) : ''}`);
      send({ type: 'ended', code });
      ws.close();
    });

    ws.on('message', (data, isBinary) => {
      if (!isBinary || !ff.stdin?.writable) return;
      if (ff.stdin.writableLength > MAX_QUEUE_BYTES) {
        send({ type: 'error', message: 'ইন্টারনেট/সার্ভার ধীর, স্ট্রিম বন্ধ হলো' });
        return this.stop(liveId);
      }
      ff.stdin.write(data as Buffer);
    });
    ws.on('close', () => {
      if (this.sessions.get(liveId) === s) {
        this.sessions.delete(liveId);
        ff.stdin?.end();
        setTimeout(() => ff.kill('SIGKILL'), 4000).unref();
      }
    });
    send({ type: 'ready' });
  }

  private args(target: string) {
    return [
      '-hide_banner', '-loglevel', 'warning',
      '-fflags', '+genpts', '-thread_queue_size', '1024',
      '-i', 'pipe:0',
      '-vf', "scale='min(1280,iw)':-2,format=yuv420p",
      '-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'zerolatency', '-profile:v', 'main',
      '-r', '30', '-g', '60', '-keyint_min', '60', '-sc_threshold', '0',
      '-b:v', `${VIDEO_KBPS}k`, '-maxrate', `${VIDEO_KBPS}k`, '-bufsize', `${VIDEO_KBPS * 2}k`,
      '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2',
      '-f', 'flv', target,
    ];
  }
}
