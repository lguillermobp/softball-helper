import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { loadOwnedClub } from "@/lib/club";

export async function POST(req: NextRequest) {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clubId } = await req.json().catch(() => ({}));
  if (!clubId) return NextResponse.json({ error: "clubId is required" }, { status: 400 });

  const owned = await loadOwnedClub(clubId, me.id, !!me.isMasterAdmin);
  if (!owned) return NextResponse.json({ error: "Club not found" }, { status: 404 });

  const club = await prisma.club.findUnique({ where: { id: clubId }, select: { stripeCustomerId: true } });
  if (!club?.stripeCustomerId) return NextResponse.json({ error: "No billing set up for this club yet." }, { status: 400 });

  const origin = req.nextUrl.origin;
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: club.stripeCustomerId,
    return_url: `${origin}/clubs`,
  });
  return NextResponse.json({ url: portalSession.url });
}
