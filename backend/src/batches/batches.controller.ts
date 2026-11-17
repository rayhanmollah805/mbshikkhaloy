import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, Roles } from '../auth/auth.guard.js';
import { AuditService } from '../audit/audit.service.js';
import { BatchesService } from './batches.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@UseGuards(AuthGuard)
@Controller()
export class BatchesController {
  constructor(
    private readonly batches: BatchesService,
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('batches')
  list(@Req() req: any) {
    return this.batches.list(req.user);
  }

  @Get('batches/:id')
  detail(@Req() req: any, @Param('id') id: string) {
    return this.batches.detail(req.user, id);
  }

  @Roles('ADMIN')
  @Post('batches')
  async create(@Req() req: any, @Body() body: any) {
    const b = await this.batches.create(body);
    await this.audit.log(req.user, 'কোর্স তৈরি', b.title);
    return b;
  }

  @Roles('ADMIN')
  @Patch('batches/:id')
  async update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const b = await this.batches.update(id, body);
    await this.audit.log(req.user, 'কোর্স সম্পাদনা', b.title, Object.keys(body).join(', '));
    return b;
  }

  @Roles('ADMIN')
  @Delete('batches/:id')
  async remove(@Req() req: any, @Param('id') id: string) {
    const b = await this.prisma.batch.findUnique({ where: { id }, select: { title: true } });
    const r = await this.batches.remove(id);
    await this.audit.log(req.user, 'কোর্স মুছে ফেলা', b?.title);
    return r;
  }

  @Roles('STUDENT')
  @Post('batches/:id/enroll')
  enroll(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.batches.enroll(req.user, id, body);
  }

  @Roles('ADMIN', 'TEACHER')
  @Get('batches/:id/students')
  students(@Req() req: any, @Param('id') id: string) {
    return this.batches.students(req.user, id);
  }

  @Roles('ADMIN', 'TEACHER')
  @Delete('batches/:id/students/:enrollmentId')
  removeStudent(@Req() req: any, @Param('id') id: string, @Param('enrollmentId') eid: string) {
    return this.batches.removeStudent(req.user, id, eid);
  }

  @Roles('STUDENT')
  @Post('batches/:id/renew')
  renew(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.batches.renew(req.user, id, body);
  }

  @Roles('ADMIN', 'TEACHER')
  @Post('batches/:id/students/:enrollmentId/extend')
  extend(@Req() req: any, @Param('id') id: string, @Param('enrollmentId') eid: string, @Body() body: any) {
    return this.batches.extendAccess(req.user, id, eid, Number(body?.days));
  }

  @Roles('ADMIN', 'TEACHER')
  @Get('dues')
  dues(@Req() req: any) {
    return this.batches.dues(req.user);
  }

  @Roles('ADMIN', 'TEACHER')
  @Get('payments/pending')
  pending(@Req() req: any) {
    return this.batches.pendingPayments(req.user);
  }

  @Roles('ADMIN', 'TEACHER')
  @Post('payments/:id/approve')
  approve(@Req() req: any, @Param('id') id: string) {
    return this.batches.decidePayment(req.user, id, true);
  }

  @Roles('ADMIN', 'TEACHER')
  @Post('payments/:id/reject')
  reject(@Req() req: any, @Param('id') id: string) {
    return this.batches.decidePayment(req.user, id, false);
  }
}
