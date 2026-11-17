// Runs `opencode run` on the HOST for the LMS backend container.
// Listens only on the docker bridge address, requires a shared secret, forces every tool off.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { timingSafeEqual } from 'node:crypto';

const HOST = process.env.BRIDGE_HOST || '172.17.0.1';
const PORT = Number(process.env.BRIDGE_PORT) || 3199;
const TOKEN = process.env.BRIDGE_TOKEN || '';
const BIN = process.env.OPENCODE_BIN || '/root/.opencode/bin/opencode';
const MAX_PARALLEL = 3;
const TIMEOUT_MS = 90_000;
if (TOKEN.length < 24) throw new Error('BRIDGE_TOKEN (>=24 chars) required');

let running = 0;
const same = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

createServer((req, res) => {
  const out = (code, o) => {
    res.writeHead(code, { 'content-type': 'application/json' });
    res.end(JSON.stringify(o));
  };
  const auth = req.headers.authorization ?? '';
  if (req.method !== 'POST' || req.url !== '/run' || !same(auth, `Bearer ${TOKEN}`)) return out(401, { error: 'unauthorized' });
  if (running >= MAX_PARALLEL) return out(429, { error: 'busy' });
  let body = '';
  req.on('data', (d) => {
    body += d;
    if (body.length > 200_000) req.destroy();
  });
  req.on('end', () => {
    let j;
    try {
      j = JSON.parse(body);
    } catch {
      return out(400, { error: 'bad json' });
    }
    const model = String(j.model ?? '');
    const prompt = String(j.prompt ?? '');
    if (!/^[\w./-]{3,80}$/.test(model) || !prompt) return out(400, { error: 'bad request' });
    let config = {};
    try {
      config = JSON.parse(String(j.config ?? '{}'));
    } catch {
      /* ignore */
    }
    // Whatever the caller sends, tools stay denied and sharing stays off.
    config = { ...config, share: 'disabled', autoupdate: false, permission: { '*': 'deny' } };
    running++;
    const child = spawn(BIN, ['run', '--model', model, '--format', 'json', prompt], {
      cwd: '/var/lib/lms-chat',
      env: { PATH: '/usr/local/bin:/usr/bin:/bin', LANG: 'C.UTF-8', HOME: '/root', OPENCODE_CONFIG_CONTENT: JSON.stringify(config), OPENCODE_DISABLE_PROJECT_CONFIG: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    });
    let stdout = '';
    let stderr = '';
    let done = false;
    const finish = (code) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      running--;
      out(200, { stdout, stderr: stderr.slice(-1500), code });
    };
    const timer = setTimeout(() => {
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        /* gone */
      }
      finish(-1);
    }, TIMEOUT_MS);
    child.stdout.on('data', (d) => (stdout = (stdout + d).slice(-200_000)));
    child.stderr.on('data', (d) => (stderr = (stderr + d).slice(-2000)));
    child.on('error', () => finish(-2));
    child.on('close', (code) => finish(code));
  });
}).listen(PORT, HOST, () => console.log(`opencode bridge on ${HOST}:${PORT}`));
