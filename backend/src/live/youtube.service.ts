import { BadGatewayException, BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';

const SCOPE = 'https://www.googleapis.com/auth/youtube';
const API = 'https://www.googleapis.com/youtube/v3';
const REFRESH_KEY = 'youtube.refreshToken';
const CHANNEL_KEY = 'youtube.channelTitle';

export type Broadcast = {
  broadcastId: string;
  streamId: string;
  videoId: string;
  ingestUrl: string;
  streamKey: string;
};

/**
 * Talks to the YouTube Data API with the refresh token the admin stored via the
 * "Connect YouTube" button. Plain fetch, no googleapis dependency.
 */
@Injectable()
export class YoutubeService {
  private readonly log = new Logger('YouTube');
  private access: { token: string; exp: number } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private get clientId() {
    return process.env.GOOGLE_CLIENT_ID ?? '';
  }
  private get clientSecret() {
    return process.env.GOOGLE_CLIENT_SECRET ?? '';
  }
  get redirectUri() {
    return `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/api/youtube/callback`;
  }
  get configured() {
    return !!(this.clientId && this.clientSecret);
  }

  private async getSetting(key: string) {
    return (await this.prisma.setting.findUnique({ where: { key } }))?.value ?? null;
  }
  private async setSetting(key: string, value: string) {
    await this.prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
  }

  async status() {
    const connected = this.configured && !!(await this.getSetting(REFRESH_KEY));
    return {
      configured: this.configured,
      connected,
      channel: connected ? await this.getSetting(CHANNEL_KEY) : null,
      redirectUri: this.redirectUri,
    };
  }

  authUrl(adminId: string) {
    if (!this.configured) throw new ServiceUnavailableException('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set');
    const state = this.jwt.sign({ sub: adminId, purpose: 'youtube-connect' }, { expiresIn: '10m' });
    const q = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: SCOPE,
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
  }

  /** Returns true when the state token was issued by authUrl(). */
  verifyState(state: string) {
    try {
      return this.jwt.verify(state).purpose === 'youtube-connect';
    } catch {
      return false;
    }
  }

  async handleCallback(code: string) {
    const r = await this.token({ grant_type: 'authorization_code', code, redirect_uri: this.redirectUri });
    if (!r.refresh_token) throw new BadRequestException('Google did not return a refresh token; remove the app from your Google account permissions and connect again.');
    await this.setSetting(REFRESH_KEY, r.refresh_token);
    this.access = { token: r.access_token, exp: Date.now() + (r.expires_in - 60) * 1000 };
    const ch = await this.call<any>('GET', '/channels', { part: 'snippet', mine: 'true' });
    await this.setSetting(CHANNEL_KEY, ch.items?.[0]?.snippet?.title ?? 'YouTube');
  }

  async disconnect() {
    await this.prisma.setting.deleteMany({ where: { key: { in: [REFRESH_KEY, CHANNEL_KEY] } } });
    this.access = null;
  }

  async isReady() {
    return this.configured && !!(await this.getSetting(REFRESH_KEY));
  }

  private async token(params: Record<string, string>) {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: this.clientId, client_secret: this.clientSecret, ...params }),
    });
    const j: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      this.log.error(`oauth ${res.status} ${j.error ?? ''} ${j.error_description ?? ''}`);
      throw new BadGatewayException('Google sign-in failed: ' + (j.error_description ?? j.error ?? res.status));
    }
    return j as { access_token: string; refresh_token?: string; expires_in: number };
  }

  private async accessToken() {
    if (this.access && this.access.exp > Date.now()) return this.access.token;
    const refresh = await this.getSetting(REFRESH_KEY);
    if (!this.configured || !refresh) throw new ServiceUnavailableException('YouTube is not connected');
    const r = await this.token({ grant_type: 'refresh_token', refresh_token: refresh });
    this.access = { token: r.access_token, exp: Date.now() + (r.expires_in - 60) * 1000 };
    return this.access.token;
  }

  private async call<T>(method: string, path: string, query: Record<string, string>, body?: unknown): Promise<T> {
    const res = await fetch(`${API}${path}?${new URLSearchParams(query)}`, {
      method,
      headers: { authorization: `Bearer ${await this.accessToken()}`, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204) return undefined as T;
    const j: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = j.error?.errors?.[0]?.reason ?? j.error?.message ?? String(res.status);
      this.log.error(`${method} ${path} ${res.status} ${msg}`);
      throw new BadGatewayException(`YouTube: ${msg}${msg === 'liveStreamingNotEnabled' ? ' (enable live streaming on the channel first)' : ''}`);
    }
    return j as T;
  }

  /** Creates the broadcast + RTMP stream and binds them. Unlisted so only people with the embed can watch. */
  async createBroadcast(title: string, startsAt: Date, endsAt: Date): Promise<Broadcast> {
    const when = startsAt.getTime() < Date.now() ? new Date(Date.now() + 60_000) : startsAt;
    const b = await this.call<any>('POST', '/liveBroadcasts', { part: 'snippet,status,contentDetails' }, {
      snippet: { title: title.slice(0, 100), scheduledStartTime: when.toISOString(), scheduledEndTime: endsAt.toISOString() },
      status: { privacyStatus: 'unlisted', selfDeclaredMadeForKids: false },
      contentDetails: {
        enableAutoStart: false,
        enableAutoStop: false,
        enableDvr: true,
        enableEmbed: true,
        recordFromStart: true,
        latencyPreference: 'low',
        monitorStream: { enableMonitorStream: false },
      },
    });
    try {
      const s = await this.call<any>('POST', '/liveStreams', { part: 'snippet,cdn,contentDetails' }, {
        snippet: { title: title.slice(0, 100) },
        cdn: { ingestionType: 'rtmp', resolution: 'variable', frameRate: 'variable' },
        contentDetails: { isReusable: false },
      });
      await this.call('POST', '/liveBroadcasts/bind', { id: b.id, part: 'id,contentDetails', streamId: s.id });
      const info = s.cdn.ingestionInfo;
      return { broadcastId: b.id, streamId: s.id, videoId: b.id, ingestUrl: info.ingestionAddress, streamKey: info.streamName };
    } catch (e) {
      await this.deleteBroadcast(b.id);
      throw e;
    }
  }

  /** Waits until YouTube reports it is receiving our RTMP data. */
  async waitStreamActive(streamId: string, timeoutMs = 45_000) {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
      const r = await this.call<any>('GET', '/liveStreams', { part: 'status', id: streamId });
      if (r.items?.[0]?.status?.streamStatus === 'active') return true;
      await new Promise((r) => setTimeout(r, 3000));
    }
    return false;
  }

  async transition(broadcastId: string, to: 'live' | 'complete') {
    await this.call('POST', '/liveBroadcasts/transition', { broadcastStatus: to, id: broadcastId, part: 'status' });
  }

  async deleteBroadcast(broadcastId: string) {
    try {
      await this.call('DELETE', '/liveBroadcasts', { id: broadcastId });
    } catch {
      /* best effort: already deleted or YouTube refused */
    }
  }
}
