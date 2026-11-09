import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AuthService {
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
    return { token: await this.sign(user), user: this.publicUser(user) };
  }

  async me(id: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id } });
    return this.publicUser(user);
  }
}
