import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminController } from './admin/admin.controller.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { BatchesController } from './batches/batches.controller.js';
import { BatchesService } from './batches/batches.service.js';
import { ChatController } from './chat/chat.controller.js';
import { ChatService } from './chat/chat.service.js';
import { ContentController } from './content/content.controller.js';
import { ExamsController } from './exams/exams.controller.js';
import { SupportAdminController, SupportController } from './support/support.controller.js';
import { SupportService } from './support/support.service.js';
import { PublicController } from './public/public.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, AuthModule],
  controllers: [
    AppController,
    AdminController,
    PublicController,
    ChatController,
    SupportController,
    SupportAdminController,
    BatchesController,
    ContentController,
    ExamsController,
  ],
  providers: [AppService, BatchesService, ChatService, SupportService],
})
export class AppModule {}
