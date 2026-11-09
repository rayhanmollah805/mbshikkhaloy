import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { hasPerm, type AuthUser } from '../auth/auth.guard.js';
import type { Perm } from '../auth/permissions.js';

/** Normalises the optional marketing fields from an admin form body. */
function marketing(body: any) {
  const out: Record<string, unknown> = {};
  if (body.subtitle !== undefined) out.subtitle = String(body.subtitle).trim().slice(0, 160) || null;
  if (body.duration !== undefined) out.duration = String(body.duration).trim().slice(0, 60) || null;
  if (body.highlights !== undefined) {
    const raw = Array.isArray(body.highlights) ? body.highlights : String(body.highlights).split('\n');
    out.highlights = raw.map((h: unknown) => String(h).trim().slice(0, 160)).filter(Boolean).slice(0, 12);
  }
  return out;
}

@Injectable()
export class BatchesService {
  constructor(private readonly prisma: PrismaService) {}

  private async isAssigned(userId: string, batchId: string) {
    return !!(await this.prisma.batchTeacher.findUnique({
      where: { batchId_userId: { batchId, userId } },
    }));
  }

  /** Batches a teacher is assigned to. */
  async assignedBatchIds(userId: string) {
    const rows = await this.prisma.batchTeacher.findMany({
      where: { userId },
      select: { batchId: true },
    });
    return rows.map((r) => r.batchId);
  }

  /**
   * Read access. Admin: all. Teacher: only assigned batches.
   * Student: only ACTIVE enrollment.
   */
  async assertAccess(user: AuthUser, batchId: string) {
    const batch = await this.prisma.batch.findUnique({ where: { id: batchId } });
    if (!batch) throw new NotFoundException('Batch not found');
    if (user.role === 'ADMIN') return batch;
    if (user.role === 'TEACHER') {
      if (!(await this.isAssigned(user.id, batchId))) {
        throw new ForbiddenException('Not assigned to this course');
      }
      return batch;
    }
    const e = await this.prisma.enrollment.findUnique({
      where: { userId_batchId: { userId: user.id, batchId } },
    });
    if (e?.status !== 'ACTIVE') throw new ForbiddenException('Not enrolled');
    return batch;
  }

  /** Write access: admin, or a teacher assigned to the batch AND holding `perm`. */
  async assertManage(user: AuthUser, batchId: string, perm: Perm) {
    const batch = await this.prisma.batch.findUnique({ where: { id: batchId } });
    if (!batch) throw new NotFoundException('Batch not found');
    if (user.role === 'ADMIN') return batch;
    if (
      user.role !== 'TEACHER' ||
      !hasPerm(user, perm) ||
      !(await this.isAssigned(user.id, batchId))
    ) {
      throw new ForbiddenException('Not allowed for this course');
    }
    return batch;
  }

  async list(user: AuthUser) {
    if (user.role !== 'STUDENT') {
      const where =
        user.role === 'ADMIN'
          ? {}
          : { teachers: { some: { userId: user.id } } };
      const batches = await this.prisma.batch.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { enrollments: true } },
          teachers: { select: { user: { select: { id: true, name: true } } } },
        },
      });
      return batches.map(({ teachers, ...b }) => ({
        ...b,
        teachers: teachers.map((t) => t.user),
        enrollment: null,
      }));
    }
    const batches = await this.prisma.batch.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { enrollments: true } },
        teachers: { select: { user: { select: { id: true, name: true } } } },
      },
    });
    const mine = await this.prisma.enrollment.findMany({
      where: { userId: user.id },
      include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    const byBatch = new Map(mine.map((e) => [e.batchId, e]));
    return batches.map(({ teachers, ...b }) => {
      const e = byBatch.get(b.id);
      return {
        ...b,
        teachers: teachers.map((t) => t.user),
        enrollment: e
          ? { status: e.status, payment: e.payments[0]?.status ?? null }
          : null,
      };
    });
  }

  async detail(user: AuthUser, id: string) {
    const batch = await this.prisma.batch.findUnique({ where: { id } });
    if (!batch) throw new NotFoundException('Batch not found');
    if (user.role === 'TEACHER' && !(await this.isAssigned(user.id, id))) {
      throw new ForbiddenException('Not assigned to this course');
    }
    return batch;
  }

  create(body: any) {
    if (!body.title?.trim()) throw new BadRequestException('title required');
    const isPaid = !!body.isPaid;
    const fee = isPaid ? Number(body.fee) : 0;
    if (isPaid && !(fee > 0)) throw new BadRequestException('fee must be > 0');
    return this.prisma.batch.create({
      data: {
        title: body.title.trim(),
        description: body.description?.trim() || null,
        isPaid,
        fee,
        ...marketing(body),
      },
    });
  }

  async update(id: string, body: any) {
    const data: any = {};
    if (body.title !== undefined) data.title = String(body.title).trim();
    if (body.description !== undefined) data.description = body.description;
    if (body.isActive !== undefined) data.isActive = !!body.isActive;
    if (body.isPaid !== undefined) data.isPaid = !!body.isPaid;
    if (body.fee !== undefined) data.fee = Number(body.fee);
    Object.assign(data, marketing(body));
    return this.prisma.batch.update({ where: { id }, data });
  }

  remove(id: string) {
    return this.prisma.batch.delete({ where: { id } });
  }

  /** Free batch → ACTIVE at once. Paid → PENDING + payment awaiting approval. */
  async enroll(user: AuthUser, batchId: string, body: any) {
    const batch = await this.prisma.batch.findUnique({ where: { id: batchId } });
    if (!batch || !batch.isActive) throw new NotFoundException('Batch not found');
    const existing = await this.prisma.enrollment.findUnique({
      where: { userId_batchId: { userId: user.id, batchId } },
    });
    if (existing && existing.status !== 'REJECTED') {
      throw new ConflictException('Already enrolled or pending');
    }
    if (!batch.isPaid) {
      return this.prisma.enrollment.upsert({
        where: { userId_batchId: { userId: user.id, batchId } },
        create: { userId: user.id, batchId, status: 'ACTIVE' },
        update: { status: 'ACTIVE' },
      });
    }
    if (!body.method?.trim() || !body.trxId?.trim()) {
      throw new BadRequestException('payment method and trxId required');
    }
    // A Transaction ID can back only one payment (rejected ones may be retried).
    const reused = await this.prisma.payment.findFirst({
      where: {
        trxId: { equals: body.trxId.trim(), mode: 'insensitive' },
        status: { not: 'REJECTED' },
      },
    });
    if (reused) throw new ConflictException('এই Transaction ID আগেই ব্যবহার হয়েছে');
    const enrollment = await this.prisma.enrollment.upsert({
      where: { userId_batchId: { userId: user.id, batchId } },
      create: { userId: user.id, batchId, status: 'PENDING' },
      update: { status: 'PENDING' },
    });
    await this.prisma.payment.create({
      data: {
        enrollmentId: enrollment.id,
        amount: batch.fee,
        method: body.method.trim(),
        trxId: body.trxId.trim(),
      },
    });
    return enrollment;
  }

  async students(user: AuthUser, batchId: string) {
    await this.assertManage(user, batchId, 'student.view');
    return this.prisma.enrollment.findMany({
      where: { batchId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        payments: { orderBy: { createdAt: 'desc' } },
      },
    });
  }

  /** Admin sees all; a teacher only their batches and only with payment.manage. */
  async pendingPayments(user: AuthUser) {
    let batchFilter = {};
    if (user.role === 'TEACHER') {
      if (!hasPerm(user, 'payment.manage')) return [];
      batchFilter = {
        enrollment: { batchId: { in: await this.assignedBatchIds(user.id) } },
      };
    }
    return this.prisma.payment.findMany({
      where: { status: 'PENDING', ...batchFilter },
      orderBy: { createdAt: 'asc' },
      include: {
        enrollment: {
          include: {
            user: { select: { name: true, email: true, phone: true } },
            batch: { select: { id: true, title: true } },
          },
        },
      },
    });
  }

  async decidePayment(user: AuthUser, id: string, approve: boolean) {
    const p = await this.prisma.payment.findUnique({
      where: { id },
      include: { enrollment: { select: { batchId: true } } },
    });
    if (!p) throw new NotFoundException();
    await this.assertManage(user, p.enrollment.batchId, 'payment.manage');
    if (p.status !== 'PENDING') throw new ConflictException('Already decided');
    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id },
        data: { status: approve ? 'APPROVED' : 'REJECTED' },
      }),
      this.prisma.enrollment.update({
        where: { id: p.enrollmentId },
        data: { status: approve ? 'ACTIVE' : 'REJECTED' },
      }),
    ]);
    return { ok: true };
  }
}
