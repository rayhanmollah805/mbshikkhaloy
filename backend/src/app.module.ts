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
import { IngestService } from './live/ingest.service.js';
import { LiveService } from './live/live.service.js';
import { LiveController } from './live/live.controller.js';
import { YoutubeService } from './live/youtube.service.js';
import { AuditService } from './audit/audit.service.js';
import { CertificatePublicController, LearningController } from './features/learning.controller.js';
import { MoneyController } from './features/money.controller.js';
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
    LiveController,
    LearningController,
    CertificatePublicController,
    MoneyController,
  ],
  providers: [AppService, BatchesService, ChatService, SupportService, YoutubeService, IngestService, LiveService, AuditService],
})
export class AppModule {}
