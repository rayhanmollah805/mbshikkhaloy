import 'dotenv/config';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { IngestService } from './live/ingest.service.js';

async function bootstrap() {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not set');
  const uploads = join(process.cwd(), 'uploads');
  mkdirSync(uploads, { recursive: true });
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  });
  // Single public hostname: the tunnel sends /api and /uploads here.
  app.setGlobalPrefix('api');
  app.useStaticAssets(uploads, { prefix: '/uploads' });
  app.get(IngestService).attach(app.getHttpServer());
  await app.listen(process.env.PORT ?? 3001);
}
await bootstrap();
