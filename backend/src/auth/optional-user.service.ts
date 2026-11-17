import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthUser } from './auth.guard.js';

/** For public endpoints: the signed-in user if a valid token is sent, else null. Never throws. */
@Injectable()
export class OptionalUserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async resolve(authHeader?: string): Promise<AuthUser | null> {
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (!token) return null;
    try {
      const { sub, purpose } = await this.jwt.verifyAsync(token);
      if (purpose) return null;
      const u = await this.prisma.user.findUnique({
        where: { id: sub },
        select: { id: true, role: true, permissions: true, isActive: true },
      });
      return u && u.isActive ? { id: u.id, role: u.role, permissions: u.permissions } : null;
    } catch {
      return null;
    }
  }
}
