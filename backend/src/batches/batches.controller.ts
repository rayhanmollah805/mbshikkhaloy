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
import { BatchesService } from './batches.service.js';

@UseGuards(AuthGuard)
@Controller()
export class BatchesController {
  constructor(private readonly batches: BatchesService) {}

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
  create(@Body() body: any) {
    return this.batches.create(body);
  }

  @Roles('ADMIN')
  @Patch('batches/:id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.batches.update(id, body);
  }

  @Roles('ADMIN')
  @Delete('batches/:id')
  remove(@Param('id') id: string) {
    return this.batches.remove(id);
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
