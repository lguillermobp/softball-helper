import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const code  = req.nextUrl.searchParams.get("code")?.trim().toUpperCase();
  const email = req.nextUrl.searchParams.get("email")?.trim().toLowerCase();

  if (!code) return NextResponse.json({ valid: false, message: "Code is required" });

  const coupon = await prisma.coupon.findUnique({ where: { code } });

  if (!coupon || !coupon.active)
    return NextResponse.json({ valid: false, message: "Invalid or inactive coupon code" });

  if (coupon.expiresAt < new Date())
    return NextResponse.json({ valid: false, message: "This coupon has expired" });

  if (coupon.maxRedemptions !== null && coupon.redemptionCount >= coupon.maxRedemptions)
    return NextResponse.json({ valid: false, message: "This coupon has reached its redemption limit" });

  if (coupon.type === "PERSONALIZED") {
    if (!email)
      return NextResponse.json({ valid: false, message: "This coupon requires an email address" });
    if (coupon.email !== email)
      return NextResponse.json({ valid: false, message: "This coupon is not valid for your email address" });
  }

  const durationLabel = coupon.duration === "FOREVER" ? "every payment" : "first payment";

  return NextResponse.json({
    valid:      true,
    percentOff: coupon.percentOff,
    duration:   coupon.duration,
    message:    `${coupon.percentOff}% off ${durationLabel}`,
  });
}
