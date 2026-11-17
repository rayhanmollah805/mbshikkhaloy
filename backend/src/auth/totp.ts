import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32(buf: Buffer) {
  let bits = 0;
  let val = 0;
  let out = '';
  for (const b of buf) {
    val = (val << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(val >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  return out;
}

export function unbase32(s: string) {
  let bits = 0;
  let val = 0;
  const out: number[] = [];
  for (const c of s.replace(/=+$/, '').toUpperCase()) {
    const i = B32.indexOf(c);
    if (i < 0) continue;
    val = (val << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((val >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export const newSecret = () => base32(randomBytes(20));

/** RFC 6238: 6 digits, 30 s step, HMAC-SHA1 (what Google Authenticator expects). */
function code(secret: string, counter: number) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac('sha1', unbase32(secret)).update(msg).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, '0');
}

/** Returns the matched time-step (allowing ±1 step of clock drift) or null. */
export function verifyTotp(secret: string, input: string, now = Date.now()): number | null {
  if (!/^\d{6}$/.test(input)) return null;
  const step = Math.floor(now / 30_000);
  for (const d of [0, -1, 1]) {
    const a = Buffer.from(code(secret, step + d));
    if (timingSafeEqual(a, Buffer.from(input))) return step + d;
  }
  return null;
}

export const otpauthUri = (secret: string, account: string, issuer: string) =>
  `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

// Secrets are encrypted at rest with a key derived from JWT_SECRET (AES-256-GCM).
const key = () => createHash('sha256').update(`totp:${process.env.JWT_SECRET ?? ''}`).digest();
export function seal(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return `${iv.toString('hex')}.${c.getAuthTag().toString('hex')}.${enc.toString('hex')}`;
}
export function unseal(sealed: string) {
  const [iv, tag, enc] = sealed.split('.').map((h) => Buffer.from(h, 'hex'));
  const d = createDecipheriv('aes-256-gcm', key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
}
