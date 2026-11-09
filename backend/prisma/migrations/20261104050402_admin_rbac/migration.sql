/*
  Warnings:

  - You are about to drop the column `teacherId` on the `Batch` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'ADMIN';

-- DropForeignKey
ALTER TABLE "Batch" DROP CONSTRAINT "Batch_teacherId_fkey";

-- AlterTable
ALTER TABLE "Batch" DROP COLUMN "teacherId";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "BatchTeacher" (
    "batchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "BatchTeacher_pkey" PRIMARY KEY ("batchId","userId")
);

-- AddForeignKey
ALTER TABLE "BatchTeacher" ADD CONSTRAINT "BatchTeacher_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchTeacher" ADD CONSTRAINT "BatchTeacher_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
