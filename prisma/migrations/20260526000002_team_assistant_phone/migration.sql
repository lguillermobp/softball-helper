-- AlterEnum
ALTER TYPE "LeagueRole" ADD VALUE 'TEAM_ASSISTANT';

-- AlterTable
ALTER TABLE "users" ADD COLUMN "phone" TEXT;
