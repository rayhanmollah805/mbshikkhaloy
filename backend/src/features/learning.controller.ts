import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { AuthGuard, Roles } from '../auth/auth.guard.js';
import { BatchesService } from '../batches/batches.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** A student counts as present once they have watched this long. */
export const PRESENT_SECONDS = 120;
/** Progress needed before a certificate can be issued. */
const CERT_MIN_PERCENT = Number(process.env.CERT_MIN_PERCENT) || 80;

const okUrl = (v: unknown) => {
  const s = String(v ?? '');
  if (s.startsWith('/uploads/')) return true;
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

@UseGuards(AuthGuard)
@Controller()
export class LearningController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly batches: BatchesService,
  ) {}

  // ================= Attendance =================
  /** Sent every ~30s by a student's open live page; adds up the time watched. */
  @Roles('STUDENT')
  @Post('live/:id/heartbeat')
  async heartbeat(@Req() req: any, @Param('id') id: string) {
    const row = await this.prisma.liveClass.findUnique({ where: { id } });
    if (!row) throw new NotFoundException();
    await this.batches.assertAccess(req.user, row.batchId);
    if (row.status !== 'LIVE') return { counted: false };
    const key = { liveClassId_userId: { liveClassId: id, userId: req.user.id } };
    const cur = await this.prisma.attendance.findUnique({ where: key });
    const now = new Date();
    if (!cur) {
      await this.prisma.attendance.create({ data: { liveClassId: id, userId: req.user.id } }).catch(() => undefined);
    } else {
      const gap = (now.getTime() - cur.lastSeenAt.getTime()) / 1000;
      // A long gap means the page was closed: don't credit the time in between.
      const add = gap <= 90 ? Math.round(Math.min(gap, 60)) : 0;
      await this.prisma.attendance.update({ where: key, data: { seconds: { increment: add }, lastSeenAt: now } });
    }
    return { counted: true };
  }

  @Roles('ADMIN', 'TEACHER')
  @Get('live/:id/attendance')
  async attendance(@Req() req: any, @Param('id') id: string) {
    const row = await this.prisma.liveClass.findUnique({ where: { id } });
    if (!row) throw new NotFoundException();
    await this.batches.assertManage(req.user, row.batchId, 'student.view');
    const [students, marks] = await Promise.all([
      this.prisma.enrollment.findMany({
        where: { batchId: row.batchId, status: 'ACTIVE' },
        include: { user: { select: { id: true, name: true, phone: true } } },
        orderBy: { user: { name: 'asc' } },
      }),
      this.prisma.attendance.findMany({ where: { liveClassId: id } }),
    ]);
    const by = new Map(marks.map((m) => [m.userId, m.seconds]));
    const rows = students.map((e) => {
      const seconds = by.get(e.userId) ?? 0;
      return { userId: e.userId, name: e.user.name, phone: e.user.phone, seconds, present: seconds >= PRESENT_SECONDS };
    });
    return { title: row.title, startsAt: row.startsAt, present: rows.filter((r) => r.present).length, total: rows.length, rows };
  }

  /** Per student: how many ended/live classes they attended. */
  @Roles('ADMIN', 'TEACHER')
  @Get('batches/:id/attendance-summary')
  async attendanceSummary(@Req() req: any, @Param('id') id: string) {
    await this.batches.assertManage(req.user, id, 'student.view');
    const total = await this.prisma.liveClass.count({ where: { batchId: id, status: { in: ['LIVE', 'ENDED'] } } });
    const marks = await this.prisma.attendance.findMany({
      where: { seconds: { gte: PRESENT_SECONDS }, liveClass: { batchId: id } },
      select: { userId: true },
    });
    const attended: Record<string, number> = {};
    for (const m of marks) attended[m.userId] = (attended[m.userId] ?? 0) + 1;
    return { total, attended };
  }

  // ================= Progress, leaderboard =================
  private async stats(batchId: string, userIds?: string[]) {
    const userFilter = userIds ? { userId: { in: userIds } } : {};
    const [materials, exams, assignments, done, attempts, subs, live, att] = await Promise.all([
      this.prisma.material.count({ where: { batchId } }),
      this.prisma.exam.count({ where: { batchId, published: true } }),
      this.prisma.assignment.count({ where: { batchId } }),
      this.prisma.materialDone.findMany({ where: { ...userFilter, material: { batchId } }, select: { userId: true, materialId: true } }),
      this.prisma.attempt.findMany({ where: { ...userFilter, exam: { batchId, published: true } }, select: { userId: true, score: true, total: true } }),
      this.prisma.submission.findMany({ where: { ...userFilter, assignment: { batchId } }, select: { userId: true } }),
      this.prisma.liveClass.count({ where: { batchId, status: { in: ['LIVE', 'ENDED'] } } }),
      this.prisma.attendance.findMany({ where: { ...userFilter, seconds: { gte: PRESENT_SECONDS }, liveClass: { batchId } }, select: { userId: true } }),
    ]);
    const count = (rows: { userId: string }[]) => {
      const m = new Map<string, number>();
      for (const r of rows) m.set(r.userId, (m.get(r.userId) ?? 0) + 1);
      return m;
    };
    const doneBy = count(done);
    const attBy = count(att);
    const subBy = count(subs);
    const attemptBy = new Map<string, { n: number; score: number; total: number }>();
    for (const a of attempts) {
      const c = attemptBy.get(a.userId) ?? { n: 0, score: 0, total: 0 };
      c.n++;
      c.score += a.score;
      c.total += a.total;
      attemptBy.set(a.userId, c);
    }
    const all = materials + exams + assignments;
    return (userId: string) => {
      const m = doneBy.get(userId) ?? 0;
      const e = attemptBy.get(userId)?.n ?? 0;
      const a = subBy.get(userId) ?? 0;
      const finished = Math.min(m, materials) + Math.min(e, exams) + Math.min(a, assignments);
      const t = attemptBy.get(userId);
      return {
        percent: all ? Math.round((finished / all) * 100) : 0,
        materials: { done: m, total: materials },
        exams: { done: e, total: exams },
        assignments: { done: a, total: assignments },
        classes: { attended: attBy.get(userId) ?? 0, total: live },
        examPct: t && t.total ? Math.round((t.score / t.total) * 100) : null,
        doneIds: undefined as string[] | undefined,
      };
    };
  }

  @Roles('STUDENT')
  @Get('batches/:id/progress')
  async progress(@Req() req: any, @Param('id') id: string) {
    await this.batches.assertAccess(req.user, id);
    const of = await this.stats(id, [req.user.id]);
    const doneIds = (await this.prisma.materialDone.findMany({ where: { userId: req.user.id, material: { batchId: id } }, select: { materialId: true } })).map((d) => d.materialId);
    const cert = await this.prisma.certificate.findUnique({ where: { userId_batchId: { userId: req.user.id, batchId: id } } });
    return { ...of(req.user.id), doneIds, certMin: CERT_MIN_PERCENT, certificate: cert?.code ?? null };
  }

  @Roles('STUDENT')
  @Post('materials/:id/done')
  async markDone(@Req() req: any, @Param('id') id: string) {
    const m = await this.prisma.material.findUnique({ where: { id } });
    if (!m) throw new NotFoundException();
    await this.batches.assertAccess(req.user, m.batchId);
    await this.prisma.materialDone.upsert({ where: { userId_materialId: { userId: req.user.id, materialId: id } }, create: { userId: req.user.id, materialId: id }, update: {} });
    return { ok: true };
  }

  @Roles('STUDENT')
  @Delete('materials/:id/done')
  async unmarkDone(@Req() req: any, @Param('id') id: string) {
    await this.prisma.materialDone.deleteMany({ where: { userId: req.user.id, materialId: id } });
    return { ok: true };
  }

  @Get('batches/:id/leaderboard')
  async leaderboard(@Req() req: any, @Param('id') id: string) {
    await this.batches.assertAccess(req.user, id);
    const students = await this.prisma.enrollment.findMany({
      where: { batchId: id, status: 'ACTIVE' },
      include: { user: { select: { id: true, name: true, photoUrl: true } } },
    });
    const of = await this.stats(id, students.map((s) => s.userId));
    const rows = students
      .map((s) => {
        const p = of(s.userId);
        return { userId: s.userId, name: s.user.name, photoUrl: s.user.photoUrl, examPct: p.examPct, exams: p.exams.done, progress: p.percent, classes: p.classes.attended };
      })
      .sort((a, b) => (b.examPct ?? -1) - (a.examPct ?? -1) || b.exams - a.exams || b.progress - a.progress || a.name.localeCompare(b.name))
      .map((r, i) => ({ ...r, rank: i + 1 }));
    const me = rows.find((r) => r.userId === req.user.id) ?? null;
    const staff = req.user.role !== 'STUDENT';
    return { total: rows.length, me, rows: staff ? rows : rows.slice(0, 10), classesTotal: rows.length ? of(rows[0].userId).classes.total : 0 };
  }

  // ================= Certificates =================
  @Roles('STUDENT')
  @Post('batches/:id/certificate')
  async issueCertificate(@Req() req: any, @Param('id') id: string) {
    await this.batches.assertAccess(req.user, id);
    const key = { userId_batchId: { userId: req.user.id, batchId: id } };
    const have = await this.prisma.certificate.findUnique({ where: key });
    if (have) return { code: have.code };
    const p = (await this.stats(id, [req.user.id]))(req.user.id);
    const items = p.materials.total + p.exams.total + p.assignments.total;
    if (!items || p.percent < CERT_MIN_PERCENT) {
      throw new ForbiddenException(`সার্টিফিকেটের জন্য কমপক্ষে ${CERT_MIN_PERCENT}% সম্পন্ন করতে হবে (এখন ${p.percent}%)`);
    }
    const c = await this.prisma.certificate.create({
      data: { userId: req.user.id, batchId: id, code: `MB-${randomBytes(5).toString('hex').toUpperCase()}` },
    });
    return { code: c.code };
  }

  // ================= Assignments =================
  @Get('batches/:id/assignments')
  async assignments(@Req() req: any, @Param('id') id: string) {
    await this.batches.assertAccess(req.user, id);
    const student = req.user.role === 'STUDENT';
    return this.prisma.assignment.findMany({
      where: { batchId: id },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { submissions: true } }, ...(student ? { submissions: { where: { userId: req.user.id } } } : {}) },
    });
  }

  @Roles('ADMIN', 'TEACHER')
  @Post('batches/:id/assignments')
  async createAssignment(@Req() req: any, @Param('id') id: string, @Body() b: any) {
    await this.batches.assertManage(req.user, id, 'content.manage');
    if (!b.title?.trim()) throw new BadRequestException('title required');
    const maxMarks = b.maxMarks === undefined || b.maxMarks === '' ? 100 : Number(b.maxMarks);
    if (!Number.isInteger(maxMarks) || maxMarks < 1 || maxMarks > 1000) throw new BadRequestException('maxMarks 1-1000');
    if (b.dueAt && isNaN(Date.parse(b.dueAt))) throw new BadRequestException('invalid dueAt');
    if (b.fileUrl && !okUrl(b.fileUrl)) throw new BadRequestException('invalid fileUrl');
    return this.prisma.assignment.create({
      data: {
        batchId: id,
        title: String(b.title).trim().slice(0, 150),
        description: b.description?.trim().slice(0, 3000) || null,
        fileUrl: b.fileUrl || null,
        dueAt: b.dueAt ? new Date(b.dueAt) : null,
        maxMarks,
      },
    });
  }

  @Roles('ADMIN', 'TEACHER')
  @Delete('assignments/:id')
  async delAssignment(@Req() req: any, @Param('id') id: string) {
    const a = await this.prisma.assignment.findUnique({ where: { id } });
    if (!a) throw new NotFoundException();
    await this.batches.assertManage(req.user, a.batchId, 'content.manage');
    await this.prisma.assignment.delete({ where: { id } });
    return { ok: true };
  }

  @Roles('STUDENT')
  @Post('assignments/:id/submit')
  async submit(@Req() req: any, @Param('id') id: string, @Body() b: any) {
    const a = await this.prisma.assignment.findUnique({ where: { id } });
    if (!a) throw new NotFoundException();
    await this.batches.assertAccess(req.user, a.batchId);
    const note = String(b.note ?? '').trim().slice(0, 2000);
    const fileUrl = b.fileUrl ? String(b.fileUrl) : null;
    if (fileUrl && !fileUrl.startsWith('/uploads/')) throw new BadRequestException('invalid file');
    if (!note && !fileUrl) throw new BadRequestException('ফাইল বা লেখা দিন');
    const key = { assignmentId_userId: { assignmentId: id, userId: req.user.id } };
    const cur = await this.prisma.submission.findUnique({ where: key });
    if (cur?.gradedAt) throw new ConflictException('নম্বর দেওয়া হয়ে গেছে, আর পরিবর্তন করা যাবে না');
    return this.prisma.submission.upsert({
      where: key,
      create: { assignmentId: id, userId: req.user.id, note: note || null, fileUrl },
      update: { note: note || null, fileUrl: fileUrl ?? cur?.fileUrl ?? null, submittedAt: new Date() },
    });
  }

  @Roles('ADMIN', 'TEACHER')
  @Get('assignments/:id/submissions')
  async submissions(@Req() req: any, @Param('id') id: string) {
    const a = await this.prisma.assignment.findUnique({ where: { id } });
    if (!a) throw new NotFoundException();
    await this.batches.assertManage(req.user, a.batchId, 'content.manage');
    const [students, subs] = await Promise.all([
      this.prisma.enrollment.findMany({
        where: { batchId: a.batchId, status: 'ACTIVE' },
        include: { user: { select: { id: true, name: true, phone: true } } },
        orderBy: { user: { name: 'asc' } },
      }),
      this.prisma.submission.findMany({ where: { assignmentId: id } }),
    ]);
    const by = new Map(subs.map((s) => [s.userId, s]));
    return {
      assignment: a,
      rows: students.map((s) => ({ userId: s.userId, name: s.user.name, phone: s.user.phone, submission: by.get(s.userId) ?? null })),
    };
  }

  @Roles('ADMIN', 'TEACHER')
  @Patch('submissions/:id/grade')
  async grade(@Req() req: any, @Param('id') id: string, @Body() b: any) {
    const s = await this.prisma.submission.findUnique({ where: { id }, include: { assignment: true } });
    if (!s) throw new NotFoundException();
    await this.batches.assertManage(req.user, s.assignment.batchId, 'content.manage');
    const marks = Number(b.marks);
    if (!Number.isInteger(marks) || marks < 0 || marks > s.assignment.maxMarks) throw new BadRequestException(`নম্বর 0-${s.assignment.maxMarks} এর মধ্যে দিন`);
    return this.prisma.submission.update({
      where: { id },
      data: { marks, feedback: String(b.feedback ?? '').trim().slice(0, 1000) || null, gradedAt: new Date() },
    });
  }

  // ================= Doubts (Q&A) =================
  @Get('batches/:id/doubts')
  async doubts(@Req() req: any, @Param('id') id: string) {
    await this.batches.assertAccess(req.user, id);
    return this.prisma.doubt.findMany({
      where: { batchId: id },
      orderBy: [{ resolved: 'asc' }, { createdAt: 'desc' }],
      take: 100,
      include: {
        user: { select: { id: true, name: true, role: true } },
        replies: { orderBy: { createdAt: 'asc' }, include: { user: { select: { id: true, name: true, role: true } } } },
      },
    });
  }

  @Post('batches/:id/doubts')
  async askDoubt(@Req() req: any, @Param('id') id: string, @Body() b: any) {
    await this.batches.assertAccess(req.user, id);
    const title = String(b.title ?? '').trim().slice(0, 150);
    const body = String(b.body ?? '').trim().slice(0, 3000);
    if (!title || !body) throw new BadRequestException('প্রশ্নের শিরোনাম ও বিস্তারিত লিখুন');
    return this.prisma.doubt.create({ data: { batchId: id, userId: req.user.id, title, body, ref: String(b.ref ?? '').trim().slice(0, 150) || null } });
  }

  private async doubtFor(req: any, id: string) {
    const d = await this.prisma.doubt.findUnique({ where: { id } });
    if (!d) throw new NotFoundException();
    await this.batches.assertAccess(req.user, d.batchId);
    return d;
  }

  @Post('doubts/:id/replies')
  async reply(@Req() req: any, @Param('id') id: string, @Body() b: any) {
    await this.doubtFor(req, id);
    const body = String(b.body ?? '').trim().slice(0, 3000);
    if (!body) throw new BadRequestException('উত্তর লিখুন');
    return this.prisma.doubtReply.create({ data: { doubtId: id, userId: req.user.id, body } });
  }

  @Patch('doubts/:id/resolve')
  async resolve(@Req() req: any, @Param('id') id: string, @Body() b: any) {
    const d = await this.doubtFor(req, id);
    if (req.user.role === 'STUDENT' && d.userId !== req.user.id) throw new ForbiddenException();
    await this.prisma.doubt.update({ where: { id }, data: { resolved: !!b.resolved } });
    return { ok: true };
  }

  @Delete('doubts/:id')
  async delDoubt(@Req() req: any, @Param('id') id: string) {
    const d = await this.doubtFor(req, id);
    if (req.user.role === 'STUDENT' && d.userId !== req.user.id) throw new ForbiddenException();
    await this.prisma.doubt.delete({ where: { id } });
    return { ok: true };
  }
}

/** Anyone holding a certificate code can check it is genuine. */
@Controller('public/certificates')
export class CertificatePublicController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':code')
  async verify(@Param('code') code: string) {
    const c = await this.prisma.certificate.findUnique({
      where: { code: code.toUpperCase() },
      include: { user: { select: { name: true } }, batch: { select: { title: true } } },
    });
    if (!c) throw new NotFoundException('সার্টিফিকেট পাওয়া যায়নি');
    return { code: c.code, name: c.user.name, course: c.batch.title, issuedAt: c.issuedAt };
  }
}
