import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { IngestService } from './ingest.service.js';
import { YoutubeService } from './youtube.service.js';

const SWEEP_MS = 30_000;

/** Ends classes (manually or when their end time passes) and keeps the recording as the same unlisted video. */
@Injectable()
export class LiveService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly log = new Logger('LiveService');
  private timer?: NodeJS.Timeout;
  private sweeping = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly yt: YoutubeService,
    private readonly ingest: IngestService,
  ) {}

  onApplicationBootstrap() {
    this.timer = setInterval(() => void this.sweep(), SWEEP_MS);
    this.timer.unref();
    void this.sweep();
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  /** Stop the stream, complete the YouTube broadcast (YouTube then keeps the archive) and mark the class ended. */
  async finish(id: string) {
    const row = await this.prisma.liveClass.findUnique({ where: { id } });
    if (!row || row.status === 'ENDED') return;
    this.ingest.stop(id);
    if (row.provider === 'YOUTUBE' && row.broadcastId && row.status === 'LIVE') {
      try {
        await this.yt.transition(row.broadcastId, 'complete');
      } catch (e) {
        // Already complete on YouTube's side is fine; anything else is logged but the class still ends here.
        this.log.warn(`complete failed for ${id}: ${(e as Error).message}`);
      }
    }
    await this.prisma.liveClass.update({ where: { id }, data: { isLive: false, status: 'ENDED' } });
  }

  /** A class whose end time passed without ever going live: close it and drop the empty broadcast. */
  private async dropMissed(id: string, broadcastId: string | null) {
    if (broadcastId) await this.yt.deleteBroadcast(broadcastId);
    await this.prisma.liveClass.update({
      where: { id },
      data: { isLive: false, status: 'ENDED', videoId: null, broadcastId: null, streamId: null, ingestUrl: null, streamKey: null },
    });
  }

  async sweep() {
    if (this.sweeping) return;
    this.sweeping = true;
    try {
      const due = await this.prisma.liveClass.findMany({
        where: { provider: 'YOUTUBE', status: { in: ['LIVE', 'SCHEDULED'] }, endsAt: { lt: new Date() } },
      });
      for (const row of due) {
        try {
          if (row.status === 'LIVE') {
            this.log.log(`end time reached, ending ${row.id}`);
            await this.finish(row.id);
          } else {
            this.log.log(`class ${row.id} never started, closing`);
            await this.dropMissed(row.id, row.broadcastId);
          }
        } catch (e) {
          this.log.error(`sweep failed for ${row.id}: ${(e as Error).message}`);
        }
      }
    } catch (e) {
      // A database hiccup must not take the server down; the next sweep retries.
      this.log.error(`sweep failed: ${(e as Error).message.slice(0, 200)}`);
    } finally {
      this.sweeping = false;
    }
  }
}
