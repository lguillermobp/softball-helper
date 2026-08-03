-- CreateEnum
CREATE TYPE "LeagueType" AS ENUM ('SOFTBALL', 'BASEBALL', 'KICKBALL');

-- AlterTable: league sport type (defaults to SOFTBALL for existing leagues)
ALTER TABLE "leagues" ADD COLUMN "type" "LeagueType" NOT NULL DEFAULT 'SOFTBALL';
