-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "content" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "currentVersion" INTEGER NOT NULL DEFAULT 0;
