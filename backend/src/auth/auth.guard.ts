import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Perm } from './permissions.js';

export type Role = 'ADMIN' | 'TEACHER' | 'STUDENT';
export type AuthUser = { id: string; role: Role; permissions: string[] };

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const hasPerm = (u: AuthUser, p: Perm) =>
  u.role === 'ADMIN' || (u.role === 'TEACHER' && u.permissions.includes(p));

/**
 * Verifies the JWT, then reloads the user from the DB so that role,
 * permissions and deactivation take effect immediately (no stale tokens).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers['authorization'];
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) throw new UnauthorizedException();
    let sub: string;
    try {
      sub = (await this.jwt.verifyAsync(token)).sub;
    } catch {
      throw new UnauthorizedException();
    }
    const user = await this.prisma.user.findUnique({
      where: { id: sub },
      select: { id: true, role: true, permissions: true, isActive: true },
    });
    if (!user || !user.isActive) throw new UnauthorizedException();
    req.user = {
      id: user.id,
      role: user.role,
      permissions: user.permissions,
    } as AuthUser;

    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (roles?.length && !roles.includes(req.user.role)) {
      throw new ForbiddenException();
    }
    return true;
  }
}
