-- CreateEnum
CREATE TYPE "LeagueSubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'LIMIT_REACHED', 'CANCELLED');

-- AlterTable: add maxGames to plans
ALTER TABLE "plans" ADD COLUMN "maxGames" INTEGER NOT NULL DEFAULT 100;

-- Update existing plans with game limits matching new pricing tiers
UPDATE "plans" SET "maxGames" = 100 WHERE "price" <= 15;
UPDATE "plans" SET "maxGames" = 200 WHERE "price" > 15 AND "price" <= 100;
UPDATE "plans" SET "maxGames" = 300 WHERE "price" > 100 AND "price" <= 250;
UPDATE "plans" SET "maxGames" = 500 WHERE "price" > 250;

-- CreateTable
CREATE TABLE "league_subscriptions" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT,
    "maxGames" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "LeagueSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "cancelledAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "league_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "league_subscriptions_leagueId_idx" ON "league_subscriptions"("leagueId");
CREATE INDEX "league_subscriptions_status_idx" ON "league_subscriptions"("status");

-- AddForeignKey
ALTER TABLE "league_subscriptions" ADD CONSTRAINT "league_subscriptions_leagueId_fkey"
    FOREIGN KEY ("leagueId") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "league_subscriptions" ADD CONSTRAINT "league_subscriptions_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
