-- CreateEnum
CREATE TYPE "CouponType" AS ENUM ('GENERAL', 'PERSONALIZED');

-- CreateEnum
CREATE TYPE "CouponDuration" AS ENUM ('ONCE', 'FOREVER');

-- CreateTable
CREATE TABLE "coupons" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "CouponType" NOT NULL DEFAULT 'GENERAL',
    "email" TEXT,
    "percentOff" DOUBLE PRECISION NOT NULL,
    "duration" "CouponDuration" NOT NULL DEFAULT 'ONCE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "maxRedemptions" INTEGER,
    "redemptionCount" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "stripePromotionCodeId" TEXT,
    "stripeCouponId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");

-- AlterTable
ALTER TABLE "leagues" ADD COLUMN "appliedCouponId" TEXT;

-- AlterTable
ALTER TABLE "fields" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC';

-- AddForeignKey
ALTER TABLE "leagues" ADD CONSTRAINT "leagues_appliedCouponId_fkey" FOREIGN KEY ("appliedCouponId") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
