import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig  = req.headers.get("stripe-signature");

  if (!sig)
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const leagueId = session.metadata?.leagueId;
      if (!leagueId) break;

      const stripeSubId = session.subscription as string | null;

      await prisma.league.update({
        where: { id: leagueId },
        data: {
          stripeCustomerId:     session.customer as string,
          stripeSubscriptionId: stripeSubId ?? undefined,
          subscriptionStatus:   "active",
        },
      });

      // Create subscription record
      await createLeagueSubscription(leagueId, stripeSubId);
      break;
    }

    case "invoice.payment_succeeded": {
      const invoice  = event.data.object as Stripe.Invoice;
      const subRaw   = invoice.parent?.subscription_details?.subscription;
      const subId    = typeof subRaw === "string" ? subRaw : subRaw?.id;
      if (!subId) break;

      // Only act on renewals (billing_reason = subscription_cycle), not the initial invoice
      if (invoice.billing_reason === "subscription_cycle") {
        const league = await prisma.league.findFirst({
          where: { stripeSubscriptionId: subId },
        });
        if (league) {
          // Cancel any currently active subscription records
          await prisma.leagueSubscription.updateMany({
            where: { leagueId: league.id, status: "ACTIVE" },
            data:  { status: "CANCELLED", cancelledAt: new Date() },
          });
          await createLeagueSubscription(league.id, subId);
        }
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice  = event.data.object as Stripe.Invoice;
      const subRaw   = invoice.parent?.subscription_details?.subscription;
      const subId    = typeof subRaw === "string" ? subRaw : subRaw?.id;
      if (!subId) break;

      await prisma.league.updateMany({
        where: { stripeSubscriptionId: subId },
        data:  { subscriptionStatus: "past_due" },
      });
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await prisma.league.updateMany({
        where: { stripeSubscriptionId: sub.id },
        data:  { subscriptionStatus: "cancelled" },
      });
      await prisma.leagueSubscription.updateMany({
        where: { stripeSubscriptionId: sub.id, status: "ACTIVE" },
        data:  { status: "CANCELLED", cancelledAt: new Date() },
      });
      break;
    }

    case "customer.subscription.updated": {
      const sub    = event.data.object as Stripe.Subscription;
      const status = sub.status === "active" ? "active"
                   : sub.status === "past_due" ? "past_due"
                   : "cancelled";
      await prisma.league.updateMany({
        where: { stripeSubscriptionId: sub.id },
        data:  { subscriptionStatus: status },
      });
      break;
    }
  }

  return NextResponse.json({ received: true });
}

async function createLeagueSubscription(leagueId: string, stripeSubId: string | null) {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: { plan: true },
  });
  if (!league) return;

  const now      = new Date();
  const endDate  = new Date(now);
  endDate.setFullYear(endDate.getFullYear() + 1);

  // Cancel any currently active subscription records
  await prisma.leagueSubscription.updateMany({
    where: { leagueId, status: "ACTIVE" },
    data:  { status: "CANCELLED", cancelledAt: now },
  });

  await prisma.leagueSubscription.create({
    data: {
      leagueId,
      planId:               league.planId,
      stripeSubscriptionId: stripeSubId,
      maxGames:             league.plan.maxGames,
      startDate:            now,
      endDate,
      status:               "ACTIVE",
    },
  });
}
