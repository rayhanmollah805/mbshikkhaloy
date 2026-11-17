import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

/** Append-only record of who did what. Never throws: a logging hiccup must not block the action. */
@Injectable()
export class AuditService {
  private readonly log_ = new Logger('Audit');
  constructor(private readonly prisma: PrismaService) {}

  async log(actor: { id: string } | null, action: string, target?: string | null, detail?: string | null) {
    try {
      const u = actor ? await this.prisma.user.findUnique({ where: { id: actor.id }, select: { name: true, role: true } }) : null;
      await this.prisma.auditLog.create({
        data: {
          actorId: actor?.id ?? null,
          actorName: u ? `${u.name} (${u.role === 'ADMIN' ? 'অ্যাডমিন' : u.role === 'TEACHER' ? 'শিক্ষক' : 'শিক্ষার্থী'})` : 'সিস্টেম',
          action,
          target: target?.slice(0, 200) ?? null,
          detail: detail?.slice(0, 500) ?? null,
        },
      });
    } catch (e) {
      this.log_.error(`audit write failed: ${(e as Error).message}`);
    }
  }
}
