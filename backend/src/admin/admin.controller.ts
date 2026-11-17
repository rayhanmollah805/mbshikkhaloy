import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'node:crypto';
import { extname, join } from 'node:path';
import bcrypt from 'bcryptjs';
import { AuthGuard, Roles } from '../auth/auth.guard.js';
import { PERMISSIONS, cleanPermissions } from '../auth/permissions.js';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SETTING_KEYS, readSettings } from '../public/public.controller.js';

const dhakaDay = (d: Date) =>
  d.toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });

/** Last `n` calendar days in Asia/Dhaka, oldest first, as YYYY-MM-DD. */
function lastDays(n: number) {
  const out: string[] = [];
  const now = Date.now();
  for (let i = n - 1; i >= 0; i--) out.push(dhakaDay(new Date(now - i * 864e5)));
  return out;
}

@UseGuards(AuthGuard)
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get('permissions')
  permissions() {
    return PERMISSIONS;
  }

  // ---------- Site settings (payment numbers, support contact) ----------
  @Get('settings')
  settings() {
    return readSettings(this.prisma);
  }

  @Put('settings')
  async saveSettings(@Req() req: any, @Body() b: any) {
    const ops = SETTING_KEYS.filter((k) => b[k] !== undefined).map((key) => {
      const value = String(b[key]).trim().slice(0, key === 'announcements' ? 1200 : 300);
      return this.prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
    });
    await this.prisma.$transaction(ops);
    await this.audit.log(req.user, 'সেটিংস পরিবর্তন', null, SETTING_KEYS.filter((k) => b[k] !== undefined).join(', '));
    return readSettings(this.prisma);
  }

  // ---------- Dashboard ----------
  @Get('stats')
  async stats() {
    const days = lastDays(30);
    const [
      students,
      teachers,
      batches,
      activeEnrollments,
      pendingPayments,
      exams,
      attempts,
      revenue,
      byStatus,
      perBatch,
      signupRows,
      revenueRows,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: 'STUDENT' } }),
      this.prisma.user.count({ where: { role: 'TEACHER', isActive: true } }),
      this.prisma.batch.count(),
      this.prisma.enrollment.count({ where: { status: 'ACTIVE' } }),
      this.prisma.payment.count({ where: { status: 'PENDING' } }),
      this.prisma.exam.count(),
      this.prisma.attempt.count(),
      this.prisma.payment.aggregate({
        where: { status: 'APPROVED' },
        _sum: { amount: true },
      }),
      this.prisma.payment.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.batch.findMany({
        select: {
          id: true,
          title: true,
          isPaid: true,
          enrollments: {
            where: { status: 'ACTIVE' },
            select: { id: true },
          },
        },
      }),
      this.prisma.$queryRaw<{ d: string; c: bigint }[]>`
        SELECT to_char("createdAt" AT TIME ZONE 'Asia/Dhaka', 'YYYY-MM-DD') AS d, count(*) AS c
        FROM "User"
        WHERE role = 'STUDENT' AND "createdAt" > now() - interval '31 days'
        GROUP BY 1`,
      this.prisma.$queryRaw<{ d: string; s: bigint }[]>`
        SELECT to_char("createdAt" AT TIME ZONE 'Asia/Dhaka', 'YYYY-MM-DD') AS d, sum(amount) AS s
        FROM "Payment"
        WHERE status = 'APPROVED' AND "createdAt" > now() - interval '31 days'
        GROUP BY 1`,
    ]);

    const signupMap = new Map(signupRows.map((r) => [r.d, Number(r.c)]));
    const revMap = new Map(revenueRows.map((r) => [r.d, Number(r.s)]));
    const statusMap = Object.fromEntries(byStatus.map((s) => [s.status, s._count._all]));

    return {
      totals: {
        students,
        teachers,
        batches,
        activeEnrollments,
        pendingPayments,
        exams,
        attempts,
        revenue: revenue._sum.amount ?? 0,
      },
      signups: days.map((date) => ({ date, value: signupMap.get(date) ?? 0 })),
      revenueByDay: days.map((date) => ({ date, value: revMap.get(date) ?? 0 })),
      payments: {
        APPROVED: statusMap.APPROVED ?? 0,
        PENDING: statusMap.PENDING ?? 0,
        REJECTED: statusMap.REJECTED ?? 0,
      },
      batches: perBatch
        .map((b) => ({ id: b.id, title: b.title, isPaid: b.isPaid, students: b.enrollments.length }))
        .sort((a, b) => b.students - a.students),
    };
  }

  // ---------- Users ----------
  @Get('users')
  async users(@Query('role') role?: string) {
    const where = ['ADMIN', 'TEACHER', 'STUDENT'].includes(role ?? '')
      ? { role: role as 'ADMIN' | 'TEACHER' | 'STUDENT' }
      : {};
    const rows = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        designation: true,
        subject: true,
        photoUrl: true,
        role: true,
        permissions: true,
        isActive: true,
        createdAt: true,
        teaching: { select: { batch: { select: { id: true, title: true } } } },
        _count: { select: { enrollments: true } },
      },
    });
    return rows.map(({ teaching, ...u }) => ({
      ...u,
      batches: teaching.map((t) => t.batch),
    }));
  }

  /** Creates a teacher (or another admin) account. Students self-register. */
  @Post('users')
  async createUser(@Req() req: any, @Body() b: any) {
    const email = String(b.email ?? '').trim().toLowerCase();
    if (!email || !b.name?.trim() || String(b.password ?? '').length < 6) {
      throw new BadRequestException('name, email, password (min 6) required');
    }
    const role = b.role === 'ADMIN' ? 'ADMIN' : 'TEACHER';
    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new ConflictException('Email already registered');
    }
    const batchIds: string[] = Array.isArray(b.batchIds) ? b.batchIds : [];
    const found = await this.prisma.batch.count({ where: { id: { in: batchIds } } });
    if (found !== new Set(batchIds).size) throw new BadRequestException('unknown batch');

    const user = await this.prisma.user.create({
      data: {
        email,
        name: b.name.trim(),
        phone: b.phone?.trim() || null,
        address: b.address?.trim() || null,
        designation: b.designation?.trim() || null,
        subject: b.subject?.trim() || null,
        passwordHash: await bcrypt.hash(b.password, 10),
        role,
        permissions: role === 'TEACHER' ? cleanPermissions(b.permissions) : [],
        teaching:
          role === 'TEACHER'
            ? { create: [...new Set(batchIds)].map((batchId) => ({ batchId })) }
            : undefined,
      },
      select: { id: true, name: true, email: true, role: true },
    });
    await this.audit.log(req.user, 'ব্যবহারকারী তৈরি', user.name, `${user.role} · ${user.email}`);
    return user;
  }

  @Patch('users/:id')
  async updateUser(@Req() req: any, @Param('id') id: string, @Body() b: any) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException();
    const data: Record<string, unknown> = {};
    if (b.name !== undefined) {
      if (!String(b.name).trim()) throw new BadRequestException('name required');
      data.name = String(b.name).trim();
    }
    if (b.phone !== undefined) data.phone = String(b.phone).trim() || null;
    for (const k of ['address', 'designation', 'subject'] as const) {
      if (b[k] !== undefined) data[k] = String(b[k]).trim() || null;
    }
    if (b.email !== undefined) {
      const email = String(b.email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('valid email required');
      if (email !== user.email) {
        if (await this.prisma.user.findUnique({ where: { email } })) throw new ConflictException('Email already registered');
        data.email = email;
      }
    }
    if (b.permissions !== undefined) data.permissions = cleanPermissions(b.permissions);
    if (b.password) {
      if (String(b.password).length < 6) throw new BadRequestException('password min 6');
      data.passwordHash = await bcrypt.hash(String(b.password), 10);
    }
    if (b.isActive !== undefined) {
      if (id === req.user.id && !b.isActive) {
        throw new BadRequestException('You cannot deactivate yourself');
      }
      data.isActive = !!b.isActive;
    }
    const out = await this.prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, isActive: true, permissions: true },
    });
    await this.audit.log(req.user, b.isActive === false ? 'ব্যবহারকারী নিষ্ক্রিয়' : 'ব্যবহারকারী সম্পাদনা', out.name, Object.keys(data).map((k) => (k === 'passwordHash' ? 'পাসওয়ার্ড' : k)).join(', '));
    return out;
  }

  /** Profile photo (JPG/PNG/WebP, max 2 MB). Admin only; served from /uploads like other files. */
  @Post('users/:id/photo')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: join(process.cwd(), 'uploads'),
        filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`),
      }),
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ok = { 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'], 'image/webp': ['.webp'] }[file.mimetype as string]?.includes(extname(file.originalname).toLowerCase());
        cb(null, !!ok);
      },
    }),
  )
  async setPhoto(@Param('id') id: string, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('JPG, PNG or WebP image required (max 2MB)');
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException();
    return this.prisma.user.update({ where: { id }, data: { photoUrl: `/uploads/${file.filename}` }, select: { id: true, photoUrl: true } });
  }

  /** Replace the set of courses a teacher is assigned to. */
  @Put('users/:id/batches')
  async setUserBatches(@Param('id') id: string, @Body() b: any) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.role !== 'TEACHER') throw new NotFoundException('Teacher not found');
    const ids = [...new Set<string>(Array.isArray(b.batchIds) ? b.batchIds : [])];
    if ((await this.prisma.batch.count({ where: { id: { in: ids } } })) !== ids.length) {
      throw new BadRequestException('unknown batch');
    }
    await this.prisma.$transaction([
      this.prisma.batchTeacher.deleteMany({ where: { userId: id } }),
      this.prisma.batchTeacher.createMany({
        data: ids.map((batchId) => ({ batchId, userId: id })),
      }),
    ]);
    return { ok: true };
  }

  /** Replace the set of teachers assigned to a course. */
  @Put('batches/:id/teachers')
  async setBatchTeachers(@Param('id') id: string, @Body() b: any) {
    if (!(await this.prisma.batch.findUnique({ where: { id } }))) {
      throw new NotFoundException('Batch not found');
    }
    const ids = [...new Set<string>(Array.isArray(b.teacherIds) ? b.teacherIds : [])];
    const teachers = await this.prisma.user.count({
      where: { id: { in: ids }, role: 'TEACHER' },
    });
    if (teachers !== ids.length) throw new BadRequestException('unknown teacher');
    await this.prisma.$transaction([
      this.prisma.batchTeacher.deleteMany({ where: { batchId: id } }),
      this.prisma.batchTeacher.createMany({
        data: ids.map((userId) => ({ batchId: id, userId })),
      }),
    ]);
    return { ok: true };
  }
}
