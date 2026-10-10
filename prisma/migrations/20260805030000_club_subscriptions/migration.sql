-- CreateTable
CREATE TABLE "club_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stripePriceId" TEXT,
    "allowSubdomain" BOOLEAN NOT NULL DEFAULT false,
    "allowAnalytics" BOOLEAN NOT NULL DEFAULT false,
    "maxTeams" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "club_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "club_plans_name_key" ON "club_plans"("name");

-- CreateTable
CREATE TABLE "club_subscriptions" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "clubPlanId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "club_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "club_subscriptions_clubId_idx" ON "club_subscriptions"("clubId");

-- AlterTable
ALTER TABLE "clubs" ADD COLUMN "stripeCustomerId" TEXT;
ALTER TABLE "clubs" ADD COLUMN "stripeSubscriptionId" TEXT;
ALTER TABLE "clubs" ADD COLUMN "subscriptionStatus" TEXT;
ALTER TABLE "clubs" ADD COLUMN "clubPlanId" TEXT;

-- AddForeignKey
ALTER TABLE "clubs" ADD CONSTRAINT "clubs_clubPlanId_fkey" FOREIGN KEY ("clubPlanId") REFERENCES "club_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_subscriptions" ADD CONSTRAINT "club_subscriptions_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_subscriptions" ADD CONSTRAINT "club_subscriptions_clubPlanId_fkey" FOREIGN KEY ("clubPlanId") REFERENCES "club_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed the three tiers (placeholder prices, no Stripe price id yet).
INSERT INTO "club_plans" ("id","name","price","allowSubdomain","allowAnalytics","maxTeams","isActive","sortOrder") VALUES
  ('clubplan_free',  'Free',       0,  false, false, 3,    true, 0),
  ('clubplan_pro',   'Team Pro',   49, true,  true,  10,   true, 1),
  ('clubplan_elite', 'Club',       99, true,  true,  NULL, true, 2);
