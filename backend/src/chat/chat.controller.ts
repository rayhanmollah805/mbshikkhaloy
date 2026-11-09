import { Body, Controller, Get, HttpCode, HttpException, Post, Req } from '@nestjs/common';
import { ChatService } from './chat.service.js';

/** Public endpoint (guests allowed). A valid token upgrades the answer's data scope. */
@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  /** Tells the widget whether the AI tab works for this visitor (guests need an API key or explicit opt-in). */
  @Get('status')
  async status(@Req() req: any) {
    const user = await this.chat.resolveUser(req.headers['authorization']);
    const guestsAllowed = this.chat.provider() === 'opencode' || !!process.env.CHATBOT_ANTHROPIC_API_KEY || process.env.CHATBOT_ALLOW_GUESTS === 'true';
    return { ai: process.env.CHATBOT_ENABLED !== 'false' && (!!user || guestsAllowed) };
  }

  @Post()
  @HttpCode(200)
  async send(@Req() req: any, @Body() body: any) {
    if (process.env.CHATBOT_ENABLED === 'false') {
      throw new HttpException({ message: 'চ্যাট সহায়ক বন্ধ আছে।' }, 503);
    }
    const user = await this.chat.resolveUser(req.headers['authorization']);
    // Behind the Cloudflare tunnel the real client IP is in CF-Connecting-IP.
    const ip = String(req.headers['cf-connecting-ip'] ?? req.ip ?? req.socket?.remoteAddress ?? 'unknown');
    return { reply: await this.chat.reply(body?.messages, user, ip) };
  }
}
