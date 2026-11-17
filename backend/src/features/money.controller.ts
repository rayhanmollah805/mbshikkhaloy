import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { AuthGuard, Roles } from '../auth/auth.guard.js';
import { BatchesService } from '../batches/batches.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@UseGuards(AuthGuard)
@Controller()
export class MoneyController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly batches: BatchesService,
    private readonly audit: AuditService,
  ) {}

  // ---------- Coupons ----------
  @Roles('ADMIN')
  @Get('coupons')
  list() {
    return this.prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
  }

  @Roles('ADMIN')
  @Post('coupons')
  async create(@Req() req: any, @Body() b: any) {
    const code = String(b.code ?? '').trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,24}$/.test(code)) throw new BadRequestException('কোড ৩-২৪ অক্ষরের (ইংরেজি অক্ষর/সংখ্যা) হতে হবে');
    const percent = Number(b.percent) || 0;
    const amount = Number(b.amount) || 0;
    if ((percent > 0) === (amount > 0)) throw new BadRequestException('শতাংশ অথবা টাকা — যেকোনো একটি দিন');
    if (percent > 100 || percent < 0 || !Number.isInteger(percent) || !Number.isInteger(amount)) throw new BadRequestException('ছাড়ের পরিমাণ সঠিক নয়');
    if (await this.prisma.coupon.findUnique({ where: { code } })) throw new BadRequestException('এই কোড আগেই আছে');
    if (b.batchId && !(await this.prisma.batch.findUnique({ where: { id: b.batchId } }))) throw new BadRequestException('কোর্স পাওয়া যায়নি');
    if (b.expiresAt && isNaN(Date.parse(b.expiresAt))) throw new BadRequestException('মেয়াদ সঠিক নয়');
    const maxUses = b.maxUses ? Number(b.maxUses) : null;
    if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1)) throw new BadRequestException('ব্যবহারের সীমা সঠিক নয়');
    const c = await this.prisma.coupon.create({
      data: { code, percent, amount, maxUses, batchId: b.batchId || null, expiresAt: b.expiresAt ? new Date(b.expiresAt) : null },
    });
    await this.audit.log(req.user, 'কুপন তৈরি', code, percent ? `${percent}%` : `৳${amount}`);
    return c;
  }

  @Roles('ADMIN')
  @Patch('coupons/:id')
  async toggle(@Req() req: any, @Param('id') id: string, @Body() b: any) {
    const c = await this.prisma.coupon.update({ where: { id }, data: { active: !!b.active } }).catch(() => null);
    if (!c) throw new NotFoundException();
    await this.audit.log(req.user, c.active ? 'কুপন চালু' : 'কুপন বন্ধ', c.code);
    return c;
  }

  @Roles('ADMIN')
  @Delete('coupons/:id')
  async remove(@Req() req: any, @Param('id') id: string) {
    const c = await this.prisma.coupon.delete({ where: { id } }).catch(() => null);
    if (!c) throw new NotFoundException();
    await this.audit.log(req.user, 'কুপন মুছে ফেলা', c.code);
    return { ok: true };
  }

  /** Checkout asks this before submitting, so the student sees the new price. */
  @Roles('STUDENT')
  @Post('coupons/validate')
  async validate(@Req() req: any, @Body() b: any) {
    const batch = await this.prisma.batch.findUnique({ where: { id: String(b.batchId ?? '') } });
    if (!batch) throw new NotFoundException();
    const p = await this.batches.price(batch, String(b.code ?? ''), req.user.id);
    return { fee: batch.fee, discount: p.discount, amount: p.amount };
  }

  // ---------- Audit log ----------
  @Roles('ADMIN')
  @Get('admin/audit')
  async audit_(@Query('q') q?: string, @Query('skip') skip?: string) {
    const term = (q ?? '').trim();
    const where = term
      ? { OR: [{ action: { contains: term, mode: 'insensitive' as const } }, { actorName: { contains: term, mode: 'insensitive' as const } }, { target: { contains: term, mode: 'insensitive' as const } }, { detail: { contains: term, mode: 'insensitive' as const } }] }
      : {};
    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: 50, skip: Math.max(0, Number(skip) || 0) }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { rows, total };
  }
}
