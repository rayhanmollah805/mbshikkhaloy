import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, Roles } from './auth.guard.js';
import { AuthService } from './auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() body: any) {
    return this.auth.registerStudent(body);
  }

  @Post('login')
  login(@Body() body: any) {
    return this.auth.login(body);
  }

  @Post('login/2fa')
  login2fa(@Body() body: any) {
    return this.auth.login2fa(body);
  }

  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  @Get('2fa/status')
  twoFactorStatus(@Req() req: any) {
    return this.auth.twoFactorStatus(req.user.id);
  }

  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  @Post('2fa/setup')
  twoFactorSetup(@Req() req: any) {
    return this.auth.twoFactorSetup(req.user.id);
  }

  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  @Post('2fa/enable')
  twoFactorEnable(@Req() req: any, @Body() body: any) {
    return this.auth.twoFactorEnable(req.user.id, body?.code);
  }

  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  @Post('2fa/disable')
  twoFactorDisable(@Req() req: any, @Body() body: any) {
    return this.auth.twoFactorDisable(req.user.id, body?.password, body?.code);
  }

  @UseGuards(AuthGuard)
  @Get('me')
  me(@Req() req: any) {
    return this.auth.me(req.user.id);
  }
}
