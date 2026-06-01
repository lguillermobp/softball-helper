-- AlterTable
ALTER TABLE "leagues" ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "stripeSubscriptionId" TEXT,
ADD COLUMN     "subscriptionStatus" TEXT NOT NULL DEFAULT 'active';

-- AlterTable
ALTER TABLE "plans" ADD COLUMN     "stripePriceId" TEXT;

-- Rename Free plan to Basic
UPDATE "plans" SET "name" = 'Basic', "price" = 9 WHERE "name" = 'Free';
