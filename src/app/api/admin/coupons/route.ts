import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

async function requireMasterAdmin() {
  const session = await auth();
  if (!(session?.user as any)?.isMasterAdmin)
    throw new Error("Forbidden");
  return session!;
}

export async function GET() {
  try {
    await requireMasterAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const coupons = await prisma.coupon.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { leagues: true } } },
  });

  return NextResponse.json({ coupons });
}

export async function POST(req: NextRequest) {
  try {
    await requireMasterAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as {
    code: string;
    type: "GENERAL" | "PERSONALIZED";
    email?: string;
    percentOff: number;
    duration: "ONCE" | "FOREVER";
    expiresAt: string;
    maxRedemptions?: number | null;
  };

  const { code, type, email, percentOff, duration, expiresAt, maxRedemptions } = body;

  if (!code?.trim()) return NextResponse.json({ error: "Code is required" }, { status: 400 });
  if (!percentOff || percentOff <= 0 || percentOff > 100)
    return NextResponse.json({ error: "percentOff must be between 1 and 100" }, { status: 400 });
  if (!expiresAt) return NextResponse.json({ error: "Expiration date is required" }, { status: 400 });
  if (type === "PERSONALIZED" && !email?.trim())
    return NextResponse.json({ error: "Email is required for personalized coupons" }, { status: 400 });

  const existing = await prisma.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (existing) return NextResponse.json({ error: "A coupon with this code already exists" }, { status: 409 });

  const redeem_by = Math.floor(new Date(expiresAt).getTime() / 1000);

  let stripeCouponId: string | null = null;
  let stripePromotionCodeId: string | null = null;

  try {
    const stripeCoupon = await stripe.coupons.create({
      percent_off: percentOff,
      duration:    duration === "FOREVER" ? "forever" : "once",
      redeem_by,
      ...(maxRedemptions ? { max_redemptions: maxRedemptions } : {}),
      metadata: { code: code.trim().toUpperCase(), type },
    });
    stripeCouponId = stripeCoupon.id;

    const promoCode = await stripe.promotionCodes.create({
      promotion:  { type: "coupon", coupon: stripeCoupon.id },
      code:       code.trim().toUpperCase(),
      expires_at: redeem_by,
      ...(maxRedemptions
        ? { max_redemptions: maxRedemptions }
        : type === "PERSONALIZED"
          ? { max_redemptions: 1 }
          : {}),
    });
    stripePromotionCodeId = promoCode.id;
  } catch (err: any) {
    // Clean up Stripe coupon if promo code creation failed
    if (stripeCouponId) {
      await stripe.coupons.del(stripeCouponId).catch(() => {});
    }
    return NextResponse.json(
      { error: err?.message ?? "Failed to create Stripe coupon" },
      { status: 502 }
    );
  }

  const coupon = await prisma.coupon.create({
    data: {
      code:                  code.trim().toUpperCase(),
      type,
      email:                 type === "PERSONALIZED" ? email!.trim().toLowerCase() : null,
      percentOff,
      duration:              duration ?? "ONCE",
      expiresAt:             new Date(expiresAt),
      maxRedemptions:        maxRedemptions ?? null,
      stripeCouponId,
      stripePromotionCodeId,
    },
  });

  return NextResponse.json({ coupon }, { status: 201 });
}
