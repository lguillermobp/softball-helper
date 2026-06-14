-- AlterTable
ALTER TABLE "leagues" ADD COLUMN "notifyGameEnd" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "leagues" ADD COLUMN "notifyEmail" TEXT;
