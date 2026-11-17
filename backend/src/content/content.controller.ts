import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { AuthGuard, Roles, hasPerm } from '../auth/auth.guard.js';
import type { AuthUser } from '../auth/auth.guard.js';
import type { Perm } from '../auth/permissions.js';
import { AuditService } from '../audit/audit.service.js';
import { BatchesService } from '../batches/batches.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { IngestService } from '../live/ingest.service.js';
import { LIVE_SECRETS } from '../live/live.controller.js';
import { YoutubeService } from '../live/youtube.service.js';

const isHttpUrl = (v: unknown) => {
  try {
    const u = new URL(String(v));
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

const UPLOAD_MIME: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'video/mp4': ['.mp4'],
  'video/webm': ['.webm'],
  'video/quicktime': ['.mov'],
};

@UseGuards(AuthGuard)
@Controller()
export class ContentController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly batches: BatchesService,
    private readonly yt: YoutubeService,
    private readonly ingest: IngestService,
    private readonly audit: AuditService,
  ) {}

  private notFound<T>(row: T | null): T {
    if (!row) throw new NotFoundException();
    return row;
  }

  // ---------- Live classes ----------
  @Get('batches/:id/live')
  async live(@Req() req: any, @Param('id') id: string) {
    await this.batches.assertAccess(req.user, id);
    return this.prisma.liveClass.findMany({
      where: { batchId: id },
      orderBy: { startsAt: 'desc' },
      omit: LIVE_SECRETS,
    });
  }

  @Roles('ADMIN', 'TEACHER')
  @Post('batches/:id/live')
  async createLive(@Req() req: any, @Param('id') id: string, @Body() b: any) {
    await this.batches.assertManage(req.user, id, 'live.manage');
    if (!b.title?.trim() || isNaN(Date.parse(b.startsAt)) || isNaN(Date.parse(b.endsAt))) {
      throw new BadRequestException('title, startsAt and endsAt required');
    }
    const startsAt = new Date(b.startsAt);
    const endsAt = new Date(b.endsAt);
    const mins = (endsAt.getTime() - startsAt.getTime()) / 60_000;
    if (mins < 5 || mins > 12 * 60) throw new BadRequestException('শেষের সময় শুরুর ৫ মিনিট থেকে ১২ ঘণ্টার মধ্যে হতে হবে');
    if (endsAt.getTime() < Date.now()) throw new BadRequestException('শেষের সময় অতীতে হতে পারে না');
    // Live classes are YouTube only (unlisted); links to other platforms are not accepted.
    if (!(await this.yt.isReady())) {
      throw new BadRequestException('YouTube সংযুক্ত নেই। অ্যাডমিনকে সেটিংস থেকে YouTube চ্যানেল কানেক্ট করতে বলুন।');
    }
    const title = b.title.trim();
    const yb = await this.yt.createBroadcast(title, startsAt, endsAt);
    return this.prisma.liveClass.create({
      data: {
        batchId: id,
        title,
        startsAt,
        endsAt,
        url: `https://www.youtube.com/watch?v=${yb.videoId}`,
        provider: 'YOUTUBE',
        videoId: yb.videoId,
        broadcastId: yb.broadcastId,
        streamId: yb.streamId,
        ingestUrl: yb.ingestUrl,
        streamKey: yb.streamKey,
      },
      omit: LIVE_SECRETS,
    });
  }

  /** Teacher toggles the "Live Class" button on/off. */
  @Roles('ADMIN', 'TEACHER')
  @Patch('live/:id')
  async setLive(@Req() req: any, @Param('id') id: string, @Body() b: any) {
    const row = this.notFound(await this.prisma.liveClass.findUnique({ where: { id } }));
    await this.batches.assertManage(req.user, row.batchId, 'live.manage');
    if (row.provider === 'YOUTUBE') {
      throw new BadRequestException('YouTube ক্লাস স্টুডিও থেকে শুরু/শেষ করুন');
    }
    return this.prisma.liveClass.update({
      where: { id },
      data: { isLive: !!b.isLive, status: b.isLive ? 'LIVE' : 'ENDED' },
      omit: LIVE_SECRETS,
    });
  }

  @Roles('ADMIN', 'TEACHER')
  @Delete('live/:id')
  async delLive(@Req() req: any, @Param('id') id: string) {
    const row = this.notFound(await this.prisma.liveClass.findUnique({ where: { id } }));
    await this.batches.assertManage(req.user, row.batchId, 'live.manage');
    this.ingest.stop(id);
    if (row.provider === 'YOUTUBE' && row.broadcastId && row.status !== 'ENDED') await this.yt.deleteBroadcast(row.broadcastId);
    await this.prisma.liveClass.delete({ where: { id } });
    await this.audit.log(req.user, 'লাইভ ক্লাস মুছে ফেলা', row.title);
    return { ok: true };
  }

  // ---------- Routine ----------
  @Get('batches/:id/routines')
  async routines(@Req() req: any, @Param('id') id: string) {
    await this.batches.assertAccess(req.user, id);
    return this.prisma.routine.findMany({
      where: { batchId: id },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  @Roles('ADMIN', 'TEACHER')
  @Post('batches/:id/routines')
  async createRoutine(@Req() req: any, @Param('id') id: string, @Body() b: any) {
    await this.batches.assertManage(req.user, id, 'routine.manage');
    const day = Number(b.dayOfWeek);
    const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (
      !(day >= 0 && day <= 6) ||
      !hhmm.test(b.startTime) ||
      !hhmm.test(b.endTime) ||
      !b.subject?.trim()
    ) {
      throw new BadRequestException('dayOfWeek 0-6, HH:mm times, subject required');
    }
    return this.prisma.routine.create({
      data: {
        batchId: id,
        dayOfWeek: day,
        startTime: b.startTime,
        endTime: b.endTime,
        subject: b.subject.trim(),
      },
    });
  }

  @Roles('ADMIN', 'TEACHER')
  @Delete('routines/:id')
  async delRoutine(@Req() req: any, @Param('id') id: string) {
    const row = this.notFound(await this.prisma.routine.findUnique({ where: { id } }));
    await this.batches.assertManage(req.user, row.batchId, 'routine.manage');
    return this.prisma.routine.delete({ where: { id } });
  }

  // ---------- Notices ----------
  /**
   * Admin: everything. Teacher: global + own batches.
   * Student: global + enrolled (ACTIVE) batches.
   */
  @Get('notices')
  async notices(@Req() req: any) {
    const user: AuthUser = req.user;
    let where: any = {};
    if (user.role === 'STUDENT') {
      const mine = await this.prisma.enrollment.findMany({
        where: { userId: user.id, status: 'ACTIVE' },
        select: { batchId: true },
      });
      where = { OR: [{ batchId: null }, { batchId: { in: mine.map((m) => m.batchId) } }] };
    } else if (user.role === 'TEACHER') {
      const ids = await this.batches.assignedBatchIds(user.id);
      where = { OR: [{ batchId: null }, { batchId: { in: ids } }] };
    }
    return this.prisma.notice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { batch: { select: { title: true } } },
    });
  }

  /** Global notices (no batchId) are admin-only. */
  @Roles('ADMIN', 'TEACHER')
  @Post('notices')
  async createNotice(@Req() req: any, @Body() b: any) {
    const user: AuthUser = req.user;
    if (!b.title?.trim() || !b.body?.trim()) {
      throw new BadRequestException('title, body required');
    }
    const batchId: string | null = b.batchId || null;
    if (batchId) await this.batches.assertManage(user, batchId, 'notice.manage');
    else if (user.role !== 'ADMIN') throw new ForbiddenException('Admin only');
    return this.prisma.notice.create({
      data: { title: b.title.trim(), body: b.body.trim(), batchId },
    });
  }

  @Roles('ADMIN', 'TEACHER')
  @Delete('notices/:id')
  async delNotice(@Req() req: any, @Param('id') id: string) {
    const row = this.notFound(await this.prisma.notice.findUnique({ where: { id } }));
    if (row.batchId) await this.batches.assertManage(req.user, row.batchId, 'notice.manage');
    else if (req.user.role !== 'ADMIN') throw new ForbiddenException('Admin only');
    return this.prisma.notice.delete({ where: { id } });
  }

  // ---------- Materials (PDF / video) ----------
  @Get('batches/:id/materials')
  async materials(@Req() req: any, @Param('id') id: string) {
    await this.batches.assertAccess(req.user, id);
    return this.prisma.material.findMany({
      where: { batchId: id },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Roles('ADMIN', 'TEACHER')
  @Post('batches/:id/materials')
  async createMaterial(@Req() req: any, @Param('id') id: string, @Body() b: any) {
    await this.batches.assertManage(req.user, id, 'content.manage');
    if (!['PDF', 'VIDEO'].includes(b.type) || !b.title?.trim()) {
      throw new BadRequestException('type (PDF|VIDEO), title required');
    }
    const url = String(b.url ?? '');
    if (!(url.startsWith('/uploads/') || isHttpUrl(url))) {
      throw new BadRequestException('valid url required');
    }
    return this.prisma.material.create({
      data: { batchId: id, type: b.type, title: b.title.trim(), url },
    });
  }

  @Roles('ADMIN', 'TEACHER')
  @Delete('materials/:id')
  async delMaterial(@Req() req: any, @Param('id') id: string) {
    const row = this.notFound(await this.prisma.material.findUnique({ where: { id } }));
    await this.batches.assertManage(req.user, row.batchId, 'content.manage');
    const out = await this.prisma.material.delete({ where: { id } });
    await this.audit.log(req.user, 'নোট/ভিডিও মুছে ফেলা', row.title);
    return out;
  }

  // ---------- File upload (PDF or video) ----------
  /**
   * Requires content.manage. The file only becomes visible to students once
   * it is attached to a batch the uploader may manage (createMaterial above).
   */
  @Roles('ADMIN', 'TEACHER')
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: join(process.cwd(), 'uploads'),
        filename: (_req, file, cb) =>
          cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`),
      }),
      limits: { fileSize: 500 * 1024 * 1024 },
      fileFilter: (req: any, file, cb) => {
        const allowed = UPLOAD_MIME[file.mimetype];
        const ok =
          !!allowed &&
          allowed.includes(extname(file.originalname).toLowerCase()) &&
          hasPerm(req.user, 'content.manage' as Perm);
        cb(null, ok);
      },
    }),
  )
  upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('PDF/MP4/WebM/MOV file required (max 500MB)');
    }
    return { url: `/uploads/${file.filename}` };
  }

  /** Students attach homework here (PDF/image/Word, max 20MB); it only becomes visible once submitted. */
  @Roles('STUDENT')
  @Post('upload/submission')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: join(process.cwd(), 'uploads'),
        filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`),
      }),
      limits: { fileSize: 20 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const types: Record<string, string[]> = {
          'application/pdf': ['.pdf'],
          'image/jpeg': ['.jpg', '.jpeg'],
          'image/png': ['.png'],
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
        };
        cb(null, !!types[file.mimetype]?.includes(extname(file.originalname).toLowerCase()));
      },
    }),
  )
  uploadSubmission(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('PDF, JPG, PNG বা DOCX ফাইল দিন (সর্বোচ্চ ২০MB)');
    return { url: `/uploads/${file.filename}` };
  }
}
