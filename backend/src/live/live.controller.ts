import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  GatewayTimeoutException,
  Logger,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard, Roles } from '../auth/auth.guard.js';
import { BatchesService } from '../batches/batches.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { IngestService } from './ingest.service.js';
import { LiveService } from './live.service.js';
import { YoutubeService } from './youtube.service.js';

/** Columns that must never leave the server. */
export const LIVE_SECRETS = { streamKey: true, ingestUrl: true, broadcastId: true, streamId: true } as const;

@Controller()
export class LiveController {
  private readonly log = new Logger('Live');

  constructor(
    private readonly prisma: PrismaService,
    private readonly batches: BatchesService,
    private readonly yt: YoutubeService,
    private readonly ingest: IngestService,
    private readonly live: LiveService,
  ) {}

  // ---------- YouTube connection (admin) ----------
  @UseGuards(AuthGuard)
  @Roles('ADMIN', 'TEACHER')
  @Get('youtube/status')
  status() {
    return this.yt.status();
  }

  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  @Get('youtube/auth-url')
  authUrl(@Req() req: any) {
    return { url: this.yt.authUrl(req.user.id) };
  }

  /** Google redirects the admin's browser here; authenticity comes from the signed state. */
  @Get('youtube/callback')
  async callback(@Query('code') code: string, @Query('state') state: string, @Query('error') error: string, @Res() res: Response) {
    const back = (r: string) => res.redirect(`${process.env.FRONTEND_URL ?? ''}/admin/settings?youtube=${r}`);
    if (error || !code || !state || !this.yt.verifyState(state)) return back('denied');
    try {
      await this.yt.handleCallback(code);
      return back('connected');
    } catch (e) {
      this.log.error(`callback failed: ${(e as Error).message}`);
      return back('error');
    }
  }

  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  @Post('youtube/disconnect')
  async disconnect() {
    await this.yt.disconnect();
    return { ok: true };
  }

  // ---------- A single class ----------
  private async load(id: string) {
    const row = await this.prisma.liveClass.findUnique({ where: { id } });
    if (!row) throw new NotFoundException();
    return row;
  }

  @UseGuards(AuthGuard)
  @Get('live/:id')
  async one(@Req() req: any, @Param('id') id: string) {
    const row = await this.prisma.liveClass.findUnique({ where: { id }, omit: LIVE_SECRETS, include: { batch: { select: { title: true } } } });
    if (!row) throw new NotFoundException();
    await this.batches.assertAccess(req.user, row.batchId);
    let canManage = false;
    try {
      await this.batches.assertManage(req.user, row.batchId, 'live.manage');
      canManage = true;
    } catch {
      /* viewer only */
    }
    return { ...row, canManage, streaming: canManage ? this.ingest.isStreaming(id) : undefined };
  }

  /** One-time ticket the studio uses to open the ingest WebSocket. */
  @UseGuards(AuthGuard)
  @Roles('ADMIN', 'TEACHER')
  @Post('live/:id/ingest-ticket')
  async ticket(@Req() req: any, @Param('id') id: string) {
    const row = await this.load(id);
    await this.batches.assertManage(req.user, row.batchId, 'live.manage');
    if (row.provider !== 'YOUTUBE') throw new ConflictException('এটি YouTube লাইভ ক্লাস নয়');
    if (row.status === 'ENDED') throw new ConflictException('ক্লাস শেষ হয়ে গেছে');
    return { ticket: this.ingest.issueTicket(id) };
  }

  /** Called once the studio is sending media: waits for YouTube to see it, then goes live. */
  @UseGuards(AuthGuard)
  @Roles('ADMIN', 'TEACHER')
  @Post('live/:id/start')
  async start(@Req() req: any, @Param('id') id: string) {
    const row = await this.load(id);
    await this.batches.assertManage(req.user, row.batchId, 'live.manage');
    if (row.provider !== 'YOUTUBE' || !row.broadcastId || !row.streamId) throw new ConflictException('এটি YouTube লাইভ ক্লাস নয়');
    if (row.status === 'ENDED') throw new ConflictException('ক্লাস শেষ হয়ে গেছে');
    if (!this.ingest.isStreaming(id)) throw new ConflictException('আগে স্টুডিও থেকে স্ট্রিম পাঠানো শুরু করুন');
    if (row.status !== 'LIVE') {
      if (!(await this.yt.waitStreamActive(row.streamId))) throw new GatewayTimeoutException('YouTube এখনো ভিডিও পায়নি, কয়েক সেকেন্ড পর আবার চেষ্টা করুন');
      try {
        await this.yt.transition(row.broadcastId, 'live');
      } catch (e) {
        // YouTube answers "redundantTransition" if it already went live on its own.
        if (!/redundantTransition/.test((e as Error).message)) throw e;
      }
    }
    await this.prisma.liveClass.update({ where: { id }, data: { isLive: true, status: 'LIVE' } });
    return { ok: true };
  }

  @UseGuards(AuthGuard)
  @Roles('ADMIN', 'TEACHER')
  @Post('live/:id/end')
  async end(@Req() req: any, @Param('id') id: string) {
    const row = await this.load(id);
    await this.batches.assertManage(req.user, row.batchId, 'live.manage');
    await this.live.finish(id);
    return { ok: true };
  }

  /** Teacher needs more time: push the automatic end back. */
  @UseGuards(AuthGuard)
  @Roles('ADMIN', 'TEACHER')
  @Post('live/:id/extend')
  async extend(@Req() req: any, @Param('id') id: string, @Body() b: any) {
    const row = await this.load(id);
    await this.batches.assertManage(req.user, row.batchId, 'live.manage');
    if (row.status === 'ENDED') throw new ConflictException('ক্লাস শেষ হয়ে গেছে');
    const min = Number(b?.minutes);
    if (!Number.isFinite(min) || min < 5 || min > 120) throw new BadRequestException('minutes must be 5-120');
    const base = Math.max(row.endsAt?.getTime() ?? 0, Date.now());
    const endsAt = new Date(base + min * 60_000);
    await this.prisma.liveClass.update({ where: { id }, data: { endsAt } });
    return { endsAt };
  }
}
