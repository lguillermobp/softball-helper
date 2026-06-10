import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

export const config = { api: { bodyParser: false } };

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

      await prisma.league.update({
        where: { id: leagueId },
        data: {
          stripeCustomerId:     session.customer as string,
          stripeSubscriptionId: session.subscription as string,
          subscriptionStatus:   "active",
        },
      });
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
