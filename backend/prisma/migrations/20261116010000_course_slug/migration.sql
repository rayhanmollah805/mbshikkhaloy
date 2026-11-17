-- AlterTable
ALTER TABLE "Batch" ADD COLUMN     "slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Batch_slug_key" ON "Batch"("slug");
