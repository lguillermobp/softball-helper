-- AlterTable: add moderation status + optional submitter email for public questions
ALTER TABLE "faqs" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PUBLISHED';
ALTER TABLE "faqs" ADD COLUMN "submitterEmail" TEXT;
