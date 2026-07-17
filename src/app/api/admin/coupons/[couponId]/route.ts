import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

interface Params { params: Promise<{ couponId: string }> }

async function requireMasterAdmin() {
  const session = await auth();
  if (!(session?.user as any)?.isMasterAdmin) throw new Error("Forbidden");
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try { await requireMasterAdmin(); }
  catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }

  const { couponId } = await params;
  const { active } = await req.json() as { active: boolean };

  const coupon = await prisma.coupon.findUnique({ where: { id: couponId } });
  if (!coupon) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Sync active state to Stripe promo code
  if (coupon.stripePromotionCodeId) {
    await stripe.promotionCodes
      .update(coupon.stripePromotionCodeId, { active })
      .catch(() => {});
  }

  const updated = await prisma.coupon.update({
    where: { id: couponId },
    data:  { active },
  });

  return NextResponse.json({ coupon: updated });
}

export async function DELETE(_: NextRequest, { params }: Params) {
  try { await requireMasterAdmin(); }
  catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }

  const { couponId } = await params;

  const coupon = await prisma.coupon.findUnique({
    where: { id: couponId },
    include: { _count: { select: { leagues: true } } },
  });
  if (!coupon) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (coupon._count.leagues > 0)
    return NextResponse.json(
      { error: "Cannot delete a coupon that has been applied to leagues" },
      { status: 409 }
    );

  // Deactivate Stripe promo code before deleting from DB
  if (coupon.stripePromotionCodeId) {
    await stripe.promotionCodes
      .update(coupon.stripePromotionCodeId, { active: false })
      .catch(() => {});
  }

  await prisma.coupon.delete({ where: { id: couponId } });
  return NextResponse.json({ success: true });
}
