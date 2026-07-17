import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId        = session.user.id!;
  const isMasterAdmin = (session.user as any).isMasterAdmin as boolean;

  const { leagueSlug } = await req.json();
  if (!leagueSlug) return NextResponse.json({ error: "leagueSlug is required" }, { status: 400 });

  const league = await prisma.league.findUnique({
    where: { slug: leagueSlug },
    include: {
      plan:          true,
      appliedCoupon: true,
      userRoles:     { where: { userId } },
    } as any,
  }) as any;
  if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });

  const isAdmin = isMasterAdmin || league.userRoles.some((r: any) => r.role === "LEAGUE_ADMIN");
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!league.plan.stripePriceId)
    return NextResponse.json({ error: "This plan has no Stripe price configured" }, { status: 400 });

  if (league.subscriptionStatus === "active" && league.stripeSubscriptionId)
    return NextResponse.json({ error: "League already has an active subscription" }, { status: 409 });

  const origin = req.nextUrl.origin;

  // Apply stored coupon if still valid
  const coupon = league.appliedCoupon;
  const couponStillValid =
    coupon?.active &&
    coupon.stripePromotionCodeId &&
    coupon.expiresAt > new Date() &&
    (coupon.maxRedemptions === null || coupon.redemptionCount < coupon.maxRedemptions);

  const discounts = couponStillValid
    ? [{ promotion_code: coupon!.stripePromotionCodeId! }]
    : [];

  const checkoutSession = await stripe.checkout.sessions.create({
    mode:                 "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: league.plan.stripePriceId, quantity: 1 }],
    ...(league.stripeCustomerId
      ? { customer: league.stripeCustomerId }
      : { customer_email: session.user.email ?? undefined }),
    ...(discounts.length ? { discounts } : {}),
    metadata: {
      leagueId:   league.id,
      leagueSlug: league.slug,
    },
    subscription_data: {
      metadata: { leagueId: league.id, leagueSlug: league.slug },
    },
    success_url: `${origin}/league/${leagueSlug}?stripe=success`,
    cancel_url:  `${origin}/league/${leagueSlug}?stripe=cancelled`,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
