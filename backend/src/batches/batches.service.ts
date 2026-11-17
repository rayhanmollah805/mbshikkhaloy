import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { AuditService } from '../audit/audit.service.js';
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

/** Lower-case, letters/digits kept (Bengali included), everything else becomes a single hyphen. */
export function slugify(text: string) {
  const s = text
    .normalize('NFC')
    .replace(/[\u200c\u200d]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  return s || 'course';
}

@Injectable()
export class BatchesService implements OnApplicationBootstrap {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** A slug nobody else uses: `base`, then `base-2`, `base-3`… */
  async uniqueSlug(text: string, excludeId?: string) {
    const base = slugify(text);
    for (let i = 1; ; i++) {
      const slug = i === 1 ? base : `${base}-${i}`;
      const hit = await this.prisma.batch.findUnique({ where: { slug }, select: { id: true } });
      if (!hit || hit.id === excludeId) return slug;
    }
  }

  /** Gives every course that predates slugs a readable one. */
  async onApplicationBootstrap() {
    const rows = await this.prisma.batch.findMany({ where: { slug: null }, select: { id: true, title: true }, orderBy: { createdAt: 'asc' } });
    for (const r of rows) {
      await this.prisma.batch.update({ where: { id: r.id }, data: { slug: await this.uniqueSlug(r.title, r.id) } });
    }
  }

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
    if (e.accessUntil && e.accessUntil.getTime() < Date.now()) {
      throw new ForbiddenException('কোর্সের মেয়াদ শেষ হয়েছে। ফি জমা দিয়ে নবায়ন করুন।');
    }
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
          ? { status: e.status, payment: e.payments[0]?.status ?? null, accessUntil: e.accessUntil }
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

  async create(body: any) {
    if (!body.title?.trim()) throw new BadRequestException('title required');
    const isPaid = !!body.isPaid;
    const fee = isPaid ? Number(body.fee) : 0;
    if (isPaid && !(fee > 0)) throw new BadRequestException('fee must be > 0');
    return this.prisma.batch.create({
      data: {
        title: body.title.trim(),
        slug: await this.uniqueSlug(String(body.slug ?? '').trim() || body.title),
        description: body.description?.trim() || null,
        isPaid,
        fee,
        billing: isPaid && body.billing === 'MONTHLY' ? 'MONTHLY' : 'ONCE',
        ...marketing(body),
      },
    });
  }

  async update(id: string, body: any) {
    const data: any = {};
    if (body.title !== undefined) data.title = String(body.title).trim();
    if (body.slug !== undefined) {
      const raw = String(body.slug).trim();
      if (raw) {
        const slug = slugify(raw);
        const clash = await this.prisma.batch.findUnique({ where: { slug }, select: { id: true } });
        if (clash && clash.id !== id) throw new ConflictException('এই স্লাগ অন্য কোর্সে ব্যবহার হচ্ছে');
        data.slug = slug;
      }
    }
    if (body.description !== undefined) data.description = body.description;
    if (body.isActive !== undefined) data.isActive = !!body.isActive;
    if (body.isPaid !== undefined) data.isPaid = !!body.isPaid;
    if (body.fee !== undefined) data.fee = Number(body.fee);
    if (body.billing !== undefined) data.billing = body.billing === 'MONTHLY' ? 'MONTHLY' : 'ONCE';
    Object.assign(data, marketing(body));
    return this.prisma.batch.update({ where: { id }, data });
  }

  remove(id: string) {
    return this.prisma.batch.delete({ where: { id } });
  }

  /** One monthly period of access. */
  private nextAccess(current: Date | null) {
    return new Date(Math.max(Date.now(), current?.getTime() ?? 0) + 30 * 864e5);
  }

  /** Price after an optional coupon. Throws a Bengali message when the code can't be used. */
  async price(batch: { id: string; fee: number }, rawCode: string, userId: string) {
    const code = rawCode.trim().toUpperCase();
    if (!code) return { amount: batch.fee, discount: 0, coupon: null };
    const bad = (m: string) => new BadRequestException(m);
    const c = await this.prisma.coupon.findUnique({ where: { code } });
    if (!c || !c.active) throw bad('কুপন কোডটি সঠিক নয়');
    if (c.expiresAt && c.expiresAt.getTime() < Date.now()) throw bad('কুপনের মেয়াদ শেষ হয়ে গেছে');
    if (c.maxUses != null && c.used >= c.maxUses) throw bad('কুপনটি আর ব্যবহার করা যাবে না');
    if (c.batchId && c.batchId !== batch.id) throw bad('এই কুপনটি এই কোর্সের জন্য নয়');
    const before = await this.prisma.payment.count({
      where: { couponCode: c.code, status: { not: 'REJECTED' }, enrollment: { userId } },
    });
    if (before) throw bad('আপনি এই কুপন আগেই ব্যবহার করেছেন');
    const raw = c.percent > 0 ? Math.round((batch.fee * c.percent) / 100) : c.amount;
    const discount = Math.min(batch.fee, Math.max(0, raw));
    return { amount: batch.fee - discount, discount, coupon: c };
  }

  /**
   * Records a payment (or, when a coupon makes it free, activates access at once).
   * `enrollmentId` is null for a first enrolment, which is created here.
   */
  private async pay(batch: { id: string; fee: number; billing: string }, userId: string, body: any, enrollment: { id: string; accessUntil: Date | null } | null) {
    const price = await this.price(batch, String(body.coupon ?? ''), userId);
    const free = price.amount === 0;
    let trxId: string;
    if (free) {
      trxId = `COUPON-${price.coupon!.code}-${randomBytes(3).toString('hex')}`;
    } else {
      if (!body.method?.trim() || !body.trxId?.trim()) {
        throw new BadRequestException('payment method and trxId required');
      }
      trxId = body.trxId.trim();
      // A Transaction ID can back only one payment (rejected ones may be retried).
      const reused = await this.prisma.payment.findFirst({
        where: { trxId: { equals: trxId, mode: 'insensitive' }, status: { not: 'REJECTED' } },
      });
      if (reused) throw new ConflictException('এই Transaction ID আগেই ব্যবহার হয়েছে');
    }
    await this.prisma.$transaction(async (tx) => {
      if (price.coupon) {
        const c = price.coupon;
        const r = await tx.coupon.updateMany({
          where: { id: c.id, ...(c.maxUses != null ? { used: { lt: c.maxUses } } : {}) },
          data: { used: { increment: 1 } },
        });
        if (!r.count) throw new BadRequestException('কুপনটি আর ব্যবহার করা যাবে না');
      }
      const enr =
        enrollment ??
        (await tx.enrollment.upsert({
          where: { userId_batchId: { userId, batchId: batch.id } },
          create: { userId, batchId: batch.id, status: 'PENDING' },
          update: { status: 'PENDING' },
        }));
      await tx.payment.create({
        data: {
          enrollmentId: enr.id,
          amount: price.amount,
          method: free ? 'Coupon' : body.method.trim(),
          trxId,
          status: free ? 'APPROVED' : 'PENDING',
          couponCode: price.coupon?.code ?? null,
          discount: price.discount,
        },
      });
      if (free) {
        await tx.enrollment.update({
          where: { id: enr.id },
          data: { status: 'ACTIVE', ...(batch.billing === 'MONTHLY' ? { accessUntil: this.nextAccess(enr.accessUntil ?? null) } : {}) },
        });
      }
    });
    return free;
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
    await this.pay(batch, user.id, body, null);
    return this.prisma.enrollment.findUnique({ where: { userId_batchId: { userId: user.id, batchId } } });
  }

  /** Monthly course: pay for the next 30 days while (or after) access runs out. */
  async renew(user: AuthUser, batchId: string, body: any) {
    const batch = await this.prisma.batch.findUnique({ where: { id: batchId } });
    if (!batch || !batch.isPaid || batch.billing !== 'MONTHLY') throw new ConflictException('এই কোর্সে মাসিক নবায়ন নেই');
    const e = await this.prisma.enrollment.findUnique({ where: { userId_batchId: { userId: user.id, batchId } } });
    if (!e || e.status !== 'ACTIVE') throw new ForbiddenException('Not enrolled');
    const pending = await this.prisma.payment.count({ where: { enrollmentId: e.id, status: 'PENDING' } });
    if (pending) throw new ConflictException('আপনার আগের পেমেন্ট যাচাই চলছে');
    await this.pay(batch, user.id, body, e);
    return { ok: true };
  }

  /** Admin/teacher gives extra days (cash payment, instalment, goodwill). */
  async extendAccess(user: AuthUser, batchId: string, enrollmentId: string, days: number) {
    await this.assertManage(user, batchId, 'payment.manage');
    if (!Number.isInteger(days) || days < 1 || days > 365) throw new BadRequestException('days must be 1-365');
    const e = await this.prisma.enrollment.findUnique({ where: { id: enrollmentId }, include: { user: { select: { name: true } } } });
    if (!e || e.batchId !== batchId) throw new NotFoundException();
    const accessUntil = new Date(Math.max(Date.now(), e.accessUntil?.getTime() ?? 0) + days * 864e5);
    await this.prisma.enrollment.update({ where: { id: enrollmentId }, data: { accessUntil } });
    await this.audit.log(user, 'মেয়াদ বাড়ানো', e.user.name, `${days} দিন`);
    return { accessUntil };
  }

  /** Active monthly students whose access has ended or ends within a week. */
  async dues(user: AuthUser) {
    let batchFilter: object = {};
    if (user.role !== 'ADMIN') {
      if (!hasPerm(user, 'payment.manage')) return [];
      batchFilter = { batchId: { in: await this.assignedBatchIds(user.id) } };
    }
    const rows = await this.prisma.enrollment.findMany({
      where: {
        ...batchFilter,
        status: 'ACTIVE',
        accessUntil: { lt: new Date(Date.now() + 7 * 864e5) },
        batch: { billing: 'MONTHLY' },
      },
      orderBy: { accessUntil: 'asc' },
      include: {
        user: { select: { name: true, phone: true, email: true } },
        batch: { select: { id: true, title: true, fee: true } },
        payments: { where: { status: 'PENDING' }, select: { id: true } },
      },
    });
    return rows.map(({ payments, ...r }) => ({ ...r, hasPending: payments.length > 0, overdue: r.accessUntil!.getTime() < Date.now() }));
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

  /** Removes a student from a course (their enrollment and its payment records). */
  async removeStudent(user: AuthUser, batchId: string, enrollmentId: string) {
    const batch = await this.assertManage(user, batchId, 'payment.manage');
    const e = await this.prisma.enrollment.findUnique({ where: { id: enrollmentId } });
    if (!e || e.batchId !== batchId) throw new NotFoundException();
    const who = await this.prisma.user.findUnique({ where: { id: e.userId }, select: { name: true } });
    await this.prisma.enrollment.delete({ where: { id: enrollmentId } });
    await this.audit.log(user, 'শিক্ষার্থী সরানো', who?.name, `কোর্স: ${batch.title}`);
    return { ok: true };
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
      include: { enrollment: { include: { batch: { select: { title: true, billing: true } }, user: { select: { name: true } } } } },
    });
    if (!p) throw new NotFoundException();
    await this.assertManage(user, p.enrollment.batchId, 'payment.manage');
    if (p.status !== 'PENDING') throw new ConflictException('Already decided');
    const enr = p.enrollment;
    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({ where: { id }, data: { status: approve ? 'APPROVED' : 'REJECTED' } });
      if (approve) {
        await tx.enrollment.update({
          where: { id: enr.id },
          data: { status: 'ACTIVE', ...(enr.batch.billing === 'MONTHLY' ? { accessUntil: this.nextAccess(enr.accessUntil) } : {}) },
        });
      } else {
        // A rejected renewal must not lock out a student who is still active.
        if (enr.status === 'PENDING') await tx.enrollment.update({ where: { id: enr.id }, data: { status: 'REJECTED' } });
        if (p.couponCode) await tx.coupon.updateMany({ where: { code: p.couponCode, used: { gt: 0 } }, data: { used: { decrement: 1 } } });
      }
    });
    await this.audit.log(user, approve ? 'পেমেন্ট অনুমোদন' : 'পেমেন্ট বাতিল', enr.user.name, `৳${p.amount} · ${p.method} · ${p.trxId} · ${enr.batch.title}`);
    return { ok: true };
  }
}
