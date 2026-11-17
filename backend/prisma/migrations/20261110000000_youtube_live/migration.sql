-- AlterTable
ALTER TABLE "LiveClass" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'MANUAL',
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
ADD COLUMN "videoId" TEXT,
ADD COLUMN "broadcastId" TEXT,
ADD COLUMN "streamId" TEXT,
ADD COLUMN "ingestUrl" TEXT,
ADD COLUMN "streamKey" TEXT;

UPDATE "LiveClass" SET "status" = 'LIVE' WHERE "isLive" = true;
