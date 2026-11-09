import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, Roles } from '../auth/auth.guard.js';
import { OptionalUserService } from '../auth/optional-user.service.js';
import { SupportService } from './support.service.js';

const clientIp = (req: any) =>
  String(req.headers['cf-connecting-ip'] ?? req.ip ?? req.socket?.remoteAddress ?? 'unknown');
const tokenOf = (req: any) => (typeof req.headers['x-support-token'] === 'string' ? req.headers['x-support-token'] : undefined);

/** Public: guests and signed-in users. Guests authenticate each call with their ticket token. */
@Controller('support')
export class SupportController {
  constructor(
    private readonly support: SupportService,
    private readonly optionalUser: OptionalUserService,
  ) {}

  private user(req: any) {
    return this.optionalUser.resolve(req.headers['authorization']);
  }

  @Post('tickets')
  async create(@Req() req: any, @Body() body: any) {
    return this.support.create(await this.user(req), clientIp(req), body);
  }

  /** The signed-in user's most recent ticket id (open ones first). */
  @Get('mine')
  async mine(@Req() req: any) {
    const u = await this.user(req);
    return u ? this.support.mine(u) : { id: null };
  }

  @Get('tickets/:id')
  async get(@Req() req: any, @Param('id') id: string) {
    return this.support.get(id, await this.user(req), tokenOf(req));
  }

  @Get('tickets/:id/unread')
  async unread(@Req() req: any, @Param('id') id: string) {
    return this.support.unread(id, await this.user(req), tokenOf(req));
  }

  @Post('tickets/:id/messages')
  @HttpCode(200)
  async post(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.support.post(id, await this.user(req), tokenOf(req), clientIp(req), body);
  }
}

@UseGuards(AuthGuard)
@Roles('ADMIN')
@Controller('admin/support')
export class SupportAdminController {
  constructor(private readonly support: SupportService) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.support.adminList(status);
  }

  // Declared before :id so "unread" is not treated as a ticket id.
  @Get('unread')
  unread() {
    return this.support.adminCount();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.support.adminGet(id);
  }

  @Post(':id/reply')
  @HttpCode(200)
  reply(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.support.adminReply(id, req.user, body);
  }

  @Patch(':id')
  setStatus(@Param('id') id: string, @Body() body: any) {
    return this.support.adminSetStatus(id, body?.status);
  }
}
