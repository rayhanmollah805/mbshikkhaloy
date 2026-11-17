import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import QRCode from 'qrcode';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';
import { newSecret, otpauthUri, seal, unseal, verifyTotp } from './totp.js';

const MAX_FAILS = 5;
const LOCK_MS = 10 * 60_000;

@Injectable()
export class AuthService {
  /** Wrong 2-step codes per user; locks the second step for a while after too many. */
  private readonly fails = new Map<string, { n: number; since: number; until: number }>();
  /** Last accepted time-step per user, so a code can't be used twice. */
  private readonly lastStep = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private sign(user: { id: string; role: string }) {
    return this.jwt.signAsync({ sub: user.id, role: user.role });
  }

  private publicUser(u: {
    id: string;
    email: string;
    name: string;
    phone: string | null;
    role: string;
    permissions: string[];
  }) {
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      phone: u.phone,
      role: u.role,
      permissions: u.permissions,
    };
  }

  /** Public sign-up always creates a STUDENT. Teachers are seeded. */
  async registerStudent(body: {
    email?: string;
    password?: string;
    name?: string;
    phone?: string;
  }) {
    const email = body.email?.trim().toLowerCase();
    if (!email || !body.name?.trim() || !body.password || body.password.length < 6) {
      throw new BadRequestException('name, email, password (min 6) required');
    }
    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new ConflictException('Email already registered');
    }
    const user = await this.prisma.user.create({
      data: {
        email,
        name: body.name.trim(),
        phone: body.phone?.trim() || null,
        passwordHash: await bcrypt.hash(body.password, 10),
        role: 'STUDENT',
      },
    });
    return { token: await this.sign(user), user: this.publicUser(user) };
  }

  /** One login for every role; the client routes by the returned role. */
  async login(body: { email?: string; password?: string }) {
    const email = body.email?.trim().toLowerCase();
    const user = email
      ? await this.prisma.user.findUnique({ where: { email } })
      : null;
    if (
      !user ||
      !user.isActive ||
      !body.password ||
      !(await bcrypt.compare(body.password, user.passwordHash))
    ) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.totpEnabled && user.totpSecret) {
      return { mfaRequired: true, mfaToken: await this.jwt.signAsync({ sub: user.id, purpose: 'mfa' }, { expiresIn: '5m' }) };
    }
    return { token: await this.sign(user), user: this.publicUser(user) };
  }

  // ---------- Authenticator (2-step) ----------
  private async audit(userId: string, name: string, action: string) {
    await this.prisma.auditLog.create({ data: { actorId: userId, actorName: `${name} (অ্যাডমিন)`, action } }).catch(() => undefined);
  }

  /** True when `input` is a valid current authenticator code or an unused recovery code (which is then consumed). */
  private async checkSecondFactor(user: { id: string; totpSecret: string | null; recoveryCodes: string[] }, input: string) {
    const text = String(input ?? '').trim();
    if (/^\d{6}$/.test(text) && user.totpSecret) {
      const step = verifyTotp(unseal(user.totpSecret), text);
      if (step === null || step <= (this.lastStep.get(user.id) ?? -1)) return false;
      this.lastStep.set(user.id, step);
      return true;
    }
    const norm = text.toLowerCase().replace(/\s/g, '');
    for (const h of user.recoveryCodes) {
      if (await bcrypt.compare(norm, h)) {
        await this.prisma.user.update({ where: { id: user.id }, data: { recoveryCodes: user.recoveryCodes.filter((x) => x !== h) } });
        return true;
      }
    }
    return false;
  }

  private throttle(id: string) {
    const f = this.fails.get(id);
    if (f && f.until > Date.now()) throw new HttpException('অনেকবার ভুল কোড দিয়েছেন, ১০ মিনিট পর আবার চেষ্টা করুন', 429);
  }
  private miss(id: string) {
    const now = Date.now();
    const f = this.fails.get(id);
    const fresh = !f || now - f.since > LOCK_MS;
    const n = (fresh ? 0 : f!.n) + 1;
    this.fails.set(id, { n, since: fresh ? now : f!.since, until: n >= MAX_FAILS ? now + LOCK_MS : 0 });
  }

  /** Step two of login: password was already accepted, now the authenticator (or recovery) code. */
  async login2fa(body: { mfaToken?: string; code?: string }) {
    let sub: string;
    try {
      const p = await this.jwt.verifyAsync(String(body.mfaToken ?? ''));
      if (p.purpose !== 'mfa') throw new Error('wrong token');
      sub = p.sub;
    } catch {
      throw new UnauthorizedException('লগইনের সময় শেষ, আবার পাসওয়ার্ড দিয়ে শুরু করুন');
    }
    const user = await this.prisma.user.findUnique({ where: { id: sub } });
    if (!user || !user.isActive || !user.totpEnabled) throw new UnauthorizedException('Invalid credentials');
    this.throttle(user.id);
    if (!(await this.checkSecondFactor(user, body.code ?? ''))) {
      this.miss(user.id);
      throw new UnauthorizedException('কোডটি ভুল বা মেয়াদ শেষ');
    }
    this.fails.delete(user.id);
    return { token: await this.sign(user), user: this.publicUser(user) };
  }

  async twoFactorStatus(id: string) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id } });
    return { enabled: u.totpEnabled, recoveryLeft: u.recoveryCodes.length };
  }

  /** Starts setup: a fresh secret is stored (not yet active) and returned as QR + text key. */
  async twoFactorSetup(id: string) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id } });
    if (u.totpEnabled) throw new ConflictException('Authenticator আগেই চালু আছে');
    const secret = newSecret();
    await this.prisma.user.update({ where: { id }, data: { totpSecret: seal(secret) } });
    const uri = otpauthUri(secret, u.email, 'LMS Medhabikash');
    return { secret, uri, qr: await QRCode.toDataURL(uri, { margin: 1, width: 240 }) };
  }

  async twoFactorEnable(id: string, code: string) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id } });
    if (u.totpEnabled) throw new ConflictException('Authenticator আগেই চালু আছে');
    if (!u.totpSecret) throw new BadRequestException('আগে সেটআপ শুরু করুন');
    this.throttle(id);
    if (verifyTotp(unseal(u.totpSecret), String(code ?? '').trim()) === null) {
      this.miss(id);
      throw new BadRequestException('কোডটি ভুল। অ্যাপে দেখানো বর্তমান ৬ সংখ্যা দিন');
    }
    const plain = Array.from({ length: 8 }, () => randomBytes(5).toString('hex').replace(/^(.{5})(.{5})$/, '$1-$2'));
    const hashes = await Promise.all(plain.map((c) => bcrypt.hash(c, 8)));
    await this.prisma.user.update({ where: { id }, data: { totpEnabled: true, recoveryCodes: hashes } });
    await this.audit(id, u.name, 'Authenticator চালু করা হয়েছে');
    return { recoveryCodes: plain };
  }

  async twoFactorDisable(id: string, password: string, code: string) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id } });
    if (!u.totpEnabled) throw new BadRequestException('Authenticator চালু নেই');
    this.throttle(id);
    if (!password || !(await bcrypt.compare(password, u.passwordHash))) throw new ForbiddenException('পাসওয়ার্ড ভুল');
    if (!(await this.checkSecondFactor(u, code))) {
      this.miss(id);
      throw new ForbiddenException('কোডটি ভুল');
    }
    await this.prisma.user.update({ where: { id }, data: { totpEnabled: false, totpSecret: null, recoveryCodes: [] } });
    await this.audit(id, u.name, 'Authenticator বন্ধ করা হয়েছে');
    return { ok: true };
  }

  async me(id: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id } });
    return this.publicUser(user);
  }
}
