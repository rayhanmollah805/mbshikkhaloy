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
import { AuthGuard, Roles } from '../auth/auth.guard.js';
import { BatchesService } from '../batches/batches.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@UseGuards(AuthGuard)
@Controller()
export class ExamsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly batches: BatchesService,
  ) {}

  @Get('batches/:id/exams')
  async list(@Req() req: any, @Param('id') id: string) {
    await this.batches.assertAccess(req.user, id);
    const teacher = req.user.role !== 'STUDENT';
    const exams = await this.prisma.exam.findMany({
      where: { batchId: id, ...(teacher ? {} : { published: true }) },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { questions: true, attempts: true } },
        attempts: teacher
          ? false
          : { where: { userId: req.user.id }, select: { score: true, total: true } },
      },
    });
    return exams.map(({ attempts, ...e }: any) => ({
      ...e,
      myAttempt: attempts?.[0] ?? null,
    }));
  }

  @Roles('ADMIN', 'TEACHER')
  @Post('batches/:id/exams')
  async create(@Req() req: any, @Param('id') id: string, @Body() b: any) {
    await this.batches.assertManage(req.user, id, 'exam.manage');
    const qs = Array.isArray(b.questions) ? b.questions : [];
    if (!b.title?.trim() || !(Number(b.durationMin) > 0) || qs.length === 0) {
      throw new BadRequestException('title, durationMin, questions required');
    }
    for (const q of qs) {
      if (
        !q.text?.trim() ||
        !Array.isArray(q.options) ||
        q.options.length < 2 ||
        q.options.some((o: unknown) => !String(o).trim()) ||
        !Number.isInteger(q.correctIndex) ||
        q.correctIndex < 0 ||
        q.correctIndex >= q.options.length
      ) {
        throw new BadRequestException('invalid question');
      }
    }
    return this.prisma.exam.create({
      data: {
        batchId: id,
        title: b.title.trim(),
        durationMin: Number(b.durationMin),
        published: !!b.published,
        questions: {
          create: qs.map((q: any) => ({
            text: q.text.trim(),
            options: q.options.map(String),
            correctIndex: q.correctIndex,
          })),
        },
      },
    });
  }

  private async examFor(user: any, id: string) {
    const exam = await this.prisma.exam.findUnique({ where: { id } });
    if (!exam) throw new NotFoundException();
    await this.batches.assertManage(user, exam.batchId, 'exam.manage');
    return exam;
  }

  @Roles('ADMIN', 'TEACHER')
  @Patch('exams/:id/publish')
  async publish(@Req() req: any, @Param('id') id: string, @Body() b: any) {
    await this.examFor(req.user, id);
    return this.prisma.exam.update({
      where: { id },
      data: { published: b.published !== false },
    });
  }

  @Roles('ADMIN', 'TEACHER')
  @Delete('exams/:id')
  async remove(@Req() req: any, @Param('id') id: string) {
    await this.examFor(req.user, id);
    return this.prisma.exam.delete({ where: { id } });
  }

  /** Students get questions WITHOUT correct answers; teachers get everything. */
  @Get('exams/:id')
  async get(@Req() req: any, @Param('id') id: string) {
    const exam = await this.prisma.exam.findUnique({
      where: { id },
      include: { questions: true },
    });
    if (!exam) throw new NotFoundException();
    await this.batches.assertAccess(req.user, exam.batchId);
    if (req.user.role !== 'STUDENT') return exam;
    if (!exam.published) throw new NotFoundException();
    const done = await this.prisma.attempt.findUnique({
      where: { examId_userId: { examId: id, userId: req.user.id } },
    });
    if (done) throw new ConflictException('Already submitted');
    return {
      ...exam,
      questions: exam.questions.map(({ correctIndex, ...q }) => q),
    };
  }

  @Roles('STUDENT')
  @Post('exams/:id/submit')
  async submit(@Req() req: any, @Param('id') id: string, @Body() b: any) {
    const exam = await this.prisma.exam.findUnique({
      where: { id },
      include: { questions: true },
    });
    if (!exam || !exam.published) throw new NotFoundException();
    await this.batches.assertAccess(req.user, exam.batchId);
    const answers: Record<string, number> = b.answers ?? {};
    let score = 0;
    for (const q of exam.questions) {
      if (answers[q.id] === q.correctIndex) score++;
    }
    try {
      await this.prisma.attempt.create({
        data: {
          examId: id,
          userId: req.user.id,
          answers,
          score,
          total: exam.questions.length,
        },
      });
    } catch {
      throw new ConflictException('Already submitted');
    }
    return { score, total: exam.questions.length };
  }

  /** Own result with correct answers (only after submission). */
  @Roles('STUDENT')
  @Get('exams/:id/result')
  async result(@Req() req: any, @Param('id') id: string) {
    const attempt = await this.prisma.attempt.findUnique({
      where: { examId_userId: { examId: id, userId: req.user.id } },
      include: { exam: { include: { questions: true } } },
    });
    if (!attempt) throw new ForbiddenException('Submit the exam first');
    await this.batches.assertAccess(req.user, attempt.exam.batchId);
    return {
      score: attempt.score,
      total: attempt.total,
      title: attempt.exam.title,
      questions: attempt.exam.questions.map((q) => ({
        id: q.id,
        text: q.text,
        options: q.options,
        correctIndex: q.correctIndex,
        yourIndex: (attempt.answers as Record<string, number>)[q.id] ?? null,
      })),
    };
  }

  @Roles('ADMIN', 'TEACHER')
  @Get('exams/:id/attempts')
  async attempts(@Req() req: any, @Param('id') id: string) {
    const exam = await this.prisma.exam.findUnique({ where: { id } });
    if (!exam) throw new NotFoundException();
    await this.batches.assertManage(req.user, exam.batchId, 'student.view');
    return this.prisma.attempt.findMany({
      where: { examId: id },
      orderBy: { score: 'desc' },
      include: { user: { select: { name: true, email: true } } },
    });
  }
}
