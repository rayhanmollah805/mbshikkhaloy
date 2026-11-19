import { BadRequestException, Body, Controller, Get, Patch, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'node:crypto';
import { extname, join } from 'node:path';
import { AuthGuard, Roles } from '../auth/auth.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { batchStats } from './stats.js';

/** Everything the student dashboard, report card and community page need. */
@UseGuards(AuthGuard)
@Roles('STUDENT')
@Controller('student')
export class StudentController {
  constructor(private readonly prisma: PrismaService) {}

  /** One row per active, unexpired course with the student's own numbers and rank. */
  private async courseRows(userId: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { userId, status: 'ACTIVE', OR: [{ accessUntil: null }, { accessUntil: { gt: new Date() } }] },
      include: { batch: { select: { id: true, title: true, slug: true } } },
      orderBy: { createdAt: 'asc' },
    });
    const certs = await this.prisma.certificate.findMany({ where: { userId }, select: { batchId: true, code: true } });
    const certBy = new Map(certs.map((c) => [c.batchId, c.code]));
    return Promise.all(
      enrollments.map(async (e) => {
        const mates = (await this.prisma.enrollment.findMany({ where: { batchId: e.batchId, status: 'ACTIVE' }, select: { userId: true } })).map((m) => m.userId);
        const of = await batchStats(this.prisma, e.batchId, mates);
        // Same ordering as the course leaderboard.
        const order = mates
          .map((id) => ({ id, ...of(id) }))
          .sort((a, b) => (b.examPct ?? -1) - (a.examPct ?? -1) || b.exams.done - a.exams.done || b.percent - a.percent);
        const mine = of(userId);
        return {
          batchId: e.batchId,
          title: e.batch.title,
          slug: e.batch.slug,
          progress: mine.percent,
          examPct: mine.examPct,
          exams: mine.exams,
          materials: mine.materials,
          assignments: mine.assignments,
          classes: mine.classes,
          rank: order.findIndex((o) => o.id === userId) + 1,
          students: mates.length,
          certificate: certBy.get(e.batchId) ?? null,
        };
      }),
    );
  }

  @Get('dashboard')
  async dashboard(@Req() req: any) {
    const userId = req.user.id as string;
    const [me, rows] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, email: true, phone: true, photoUrl: true } }),
      this.courseRows(userId),
    ]);
    const batchIds = rows.map((r) => r.batchId);
    const titleOf = new Map(rows.map((r) => [r.batchId, r.title]));
    const now = new Date();

    const [exams, attempts, assignments, enrolled, classes] = await Promise.all([
      this.prisma.exam.findMany({
        where: { batchId: { in: batchIds }, published: true, attempts: { none: { userId } } },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: { id: true, title: true, batchId: true, durationMin: true, _count: { select: { questions: true } } },
      }),
      this.prisma.attempt.findMany({
        where: { userId, exam: { batchId: { in: batchIds }, published: true } },
        orderBy: { submittedAt: 'desc' },
        select: { id: true, examId: true, score: true, total: true, submittedAt: true, exam: { select: { title: true, batchId: true } } },
      }),
      this.prisma.assignment.findMany({
        where: { batchId: { in: batchIds } },
        include: { submissions: { where: { userId } }, _count: { select: { submissions: true } } },
      }),
      this.prisma.enrollment.groupBy({ by: ['batchId'], where: { batchId: { in: batchIds }, status: 'ACTIVE' }, _count: { _all: true } }),
      this.prisma.liveClass.findMany({
        where: { batchId: { in: batchIds }, status: { in: ['SCHEDULED', 'LIVE'] }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
        orderBy: { startsAt: 'asc' },
        take: 6,
        select: { id: true, title: true, startsAt: true, endsAt: true, status: true, provider: true, batchId: true },
      }),
    ]);
    const roster = new Map(enrolled.map((e) => [e.batchId, e._count._all]));

    const assignmentRows = assignments
      .map((a) => {
        const s = a.submissions[0];
        return {
          id: a.id,
          title: a.title,
          batchId: a.batchId,
          course: titleOf.get(a.batchId) ?? '',
          dueAt: a.dueAt,
          maxMarks: a.maxMarks,
          submitted: !!s,
          marks: s?.gradedAt ? s.marks : null,
          classPct: Math.min(100, Math.round((a._count.submissions / Math.max(1, roster.get(a.batchId) ?? 1)) * 100)),
        };
      })
      // Not yet handed in first (soonest deadline first), then the rest.
      .sort((x, y) => Number(x.submitted) - Number(y.submitted) || (x.dueAt?.getTime() ?? Infinity) - (y.dueAt?.getTime() ?? Infinity))
      .slice(0, 5);

    const withExam = rows.filter((r) => r.examPct !== null);
    const overall = attempts.length ? Math.round(attempts.reduce((n, a) => n + (a.total ? (a.score / a.total) * 100 : 0), 0) / attempts.length) : null;
    const best = rows.filter((r) => r.rank > 0).sort((a, b) => a.rank - b.rank)[0] ?? null;
    const focus = [...rows].sort((a, b) => b.progress - a.progress)[0] ?? null;

    return {
      profile: { ...me, courses: rows.length, examsTaken: attempts.length, avgPct: overall, bestRank: best ? { rank: best.rank, of: best.students, course: best.title } : null },
      subjects: withExam.map((r) => ({ course: r.title, pct: r.examPct })),
      overallPct: overall,
      focus: focus ? { course: focus.title, progress: focus.progress, batchId: focus.batchId } : null,
      lastResult: attempts[0] ? { exam: attempts[0].exam.title, score: attempts[0].score, total: attempts[0].total, id: attempts[0].examId } : null,
      upcomingExams: exams.map((e) => ({ id: e.id, title: e.title, course: titleOf.get(e.batchId) ?? '', durationMin: e.durationMin, questions: e._count.questions })),
      assignments: assignmentRows,
      assignmentsTotal: assignments.length,
      upcomingClasses: classes.map((c) => ({ id: c.id, title: c.title, startsAt: c.startsAt, endsAt: c.endsAt, status: c.status, course: titleOf.get(c.batchId) ?? '' })),
    };
  }

  /** Data behind the printable report card. */
  @Get('report')
  async report(@Req() req: any) {
    const me = await this.prisma.user.findUniqueOrThrow({ where: { id: req.user.id }, select: { name: true, email: true, phone: true } });
    const rows = await this.courseRows(req.user.id);
    const marks = await this.prisma.submission.findMany({
      where: { userId: req.user.id, gradedAt: { not: null }, assignment: { batchId: { in: rows.map((r) => r.batchId) } } },
      select: { marks: true, assignment: { select: { batchId: true, maxMarks: true } } },
    });
    return {
      student: me,
      generatedAt: new Date(),
      courses: rows.map((r) => {
        const m = marks.filter((x) => x.assignment.batchId === r.batchId);
        return { ...r, assignmentMarks: m.reduce((n, x) => n + (x.marks ?? 0), 0), assignmentMax: m.reduce((n, x) => n + x.assignment.maxMarks, 0) };
      }),
    };
  }

  /** Recent questions across all of the student's courses. */
  @Get('community')
  async community(@Req() req: any) {
    const en = await this.prisma.enrollment.findMany({
      where: { userId: req.user.id, status: 'ACTIVE' },
      select: { batch: { select: { id: true, title: true } } },
    });
    const ids = en.map((e) => e.batch.id);
    const doubts = await this.prisma.doubt.findMany({
      where: { batchId: { in: ids } },
      orderBy: { createdAt: 'desc' },
      take: 40,
      include: { user: { select: { name: true, role: true } }, batch: { select: { id: true, title: true } }, _count: { select: { replies: true } } },
    });
    return {
      courses: en.map((e) => e.batch),
      doubts: doubts.map((d) => ({ id: d.id, title: d.title, body: d.body.slice(0, 160), resolved: d.resolved, createdAt: d.createdAt, author: d.user.name, authorRole: d.user.role, batchId: d.batch.id, course: d.batch.title, replies: d._count.replies })),
    };
  }

  // ---------- Own profile ----------
  @Patch('profile')
  async profile(@Req() req: any, @Body() b: any) {
    const data: Record<string, unknown> = {};
    if (b.name !== undefined) {
      const name = String(b.name).trim().slice(0, 80);
      if (!name) throw new BadRequestException('নাম লিখুন');
      data.name = name;
    }
    if (b.phone !== undefined) data.phone = String(b.phone).trim().slice(0, 20) || null;
    return this.prisma.user.update({ where: { id: req.user.id }, data, select: { id: true, name: true, phone: true, photoUrl: true } });
  }

  @Post('photo')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: join(process.cwd(), 'uploads'),
        filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`),
      }),
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ok = ({ 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'], 'image/webp': ['.webp'] } as Record<string, string[]>)[file.mimetype]?.includes(extname(file.originalname).toLowerCase());
        cb(null, !!ok);
      },
    }),
  )
  async photo(@Req() req: any, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('JPG, PNG বা WebP ছবি দিন (সর্বোচ্চ ২MB)');
    return this.prisma.user.update({ where: { id: req.user.id }, data: { photoUrl: `/uploads/${file.filename}` }, select: { id: true, photoUrl: true } });
  }
}
