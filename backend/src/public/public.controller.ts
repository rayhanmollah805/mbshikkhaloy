import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

/** Settings an admin may edit; also what the public site is allowed to read. */
export const SETTING_KEYS = [
  'bkash',
  'nagad',
  'rocket',
  'bank',
  'supportPhone',
  'supportEmail',
  'siteName',
  'siteTagline',
  'announcements', // one notice per line; shown in the home page ticker and notice board
] as const;

export async function readSettings(prisma: PrismaService) {
  const rows = await prisma.setting.findMany({ where: { key: { in: [...SETTING_KEYS] } } });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return Object.fromEntries(SETTING_KEYS.map((k) => [k, map[k] ?? ''])) as Record<
    (typeof SETTING_KEYS)[number],
    string
  >;
}

/**
 * Unauthenticated marketing endpoints. They expose only what a visitor needs
 * to decide to enrol: never file URLs, emails, phones, or student data.
 */
@Controller('public')
export class PublicController {
  constructor(private readonly prisma: PrismaService) {}

  /** Headline numbers (real counts) + payment/contact info for the checkout. */
  @Get('site')
  async site() {
    const [students, courses, teachers, settings] = await Promise.all([
      this.prisma.user.count({ where: { role: 'STUDENT', isActive: true } }),
      this.prisma.batch.count({ where: { isActive: true } }),
      this.prisma.user.count({
        where: { role: 'TEACHER', isActive: true, teaching: { some: { batch: { isActive: true } } } },
      }),
      readSettings(this.prisma),
    ]);
    return { stats: { students, courses, teachers }, settings };
  }

  @Get('courses')
  async courses() {
    const rows = await this.prisma.batch.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        subtitle: true,
        description: true,
        isPaid: true,
        fee: true,
        duration: true,
        teachers: { select: { user: { select: { name: true } } } },
        _count: {
          select: { enrollments: { where: { status: 'ACTIVE' } }, materials: true, exams: { where: { published: true } } },
        },
      },
    });
    return rows.map(({ teachers, _count, ...c }) => ({
      ...c,
      teachers: teachers.map((t) => t.user.name),
      students: _count.enrollments,
      materials: _count.materials,
      exams: _count.exams,
    }));
  }

  /** Course page: curriculum outline lists titles only, never the file URLs. */
  @Get('courses/:id')
  async course(@Param('id') id: string) {
    const c = await this.prisma.batch.findFirst({
      where: { id, isActive: true },
      select: {
        id: true,
        title: true,
        subtitle: true,
        description: true,
        highlights: true,
        duration: true,
        isPaid: true,
        fee: true,
        teachers: { select: { user: { select: { name: true } } } },
        routines: {
          orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
          select: { dayOfWeek: true, startTime: true, endTime: true, subject: true },
        },
        materials: {
          orderBy: { createdAt: 'asc' },
          select: { type: true, title: true },
        },
        exams: {
          where: { published: true },
          orderBy: { createdAt: 'asc' },
          select: { title: true, durationMin: true, _count: { select: { questions: true } } },
        },
        _count: { select: { enrollments: { where: { status: 'ACTIVE' } }, liveClasses: true } },
      },
    });
    if (!c) throw new NotFoundException('Course not found');
    const { teachers, exams, _count, ...rest } = c;
    return {
      ...rest,
      teachers: teachers.map((t) => t.user.name),
      exams: exams.map((e) => ({ title: e.title, durationMin: e.durationMin, questions: e._count.questions })),
      students: _count.enrollments,
      liveClasses: _count.liveClasses,
    };
  }
}
