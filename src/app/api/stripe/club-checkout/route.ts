import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { loadOwnedClub } from "@/lib/club";

export async function POST(req: NextRequest) {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clubId, planId } = await req.json().catch(() => ({}));
  if (!clubId || !planId) return NextResponse.json({ error: "clubId and planId are required" }, { status: 400 });

  const owned = await loadOwnedClub(clubId, me.id, !!me.isMasterAdmin);
  if (!owned) return NextResponse.json({ error: "Club not found" }, { status: 404 });

  const club = await prisma.club.findUnique({ where: { id: clubId }, select: { id: true, stripeCustomerId: true, subscriptionStatus: true, stripeSubscriptionId: true } });
  const plan = await prisma.clubPlan.findFirst({ where: { id: planId, isActive: true }, select: { id: true, name: true, stripePriceId: true } });
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  if (!plan.stripePriceId) return NextResponse.json({ error: "This plan isn't available for checkout yet (no Stripe price configured)." }, { status: 400 });
  if (club?.subscriptionStatus === "active" && club.stripeSubscriptionId)
    return NextResponse.json({ error: "This club already has an active subscription — use Manage billing to change it." }, { status: 409 });

  const origin = req.nextUrl.origin;
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    ...(club?.stripeCustomerId ? { customer: club.stripeCustomerId } : { customer_email: me.email ?? undefined }),
    metadata: { clubId, clubPlanId: plan.id },
    subscription_data: { metadata: { clubId, clubPlanId: plan.id } },
    success_url: `${origin}/clubs?stripe=success`,
    cancel_url: `${origin}/clubs?stripe=cancelled`,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
