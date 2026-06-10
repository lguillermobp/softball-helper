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
    where:   { slug: leagueSlug },
    include: { userRoles: { where: { userId } } },
  });
  if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });

  const isAdmin = isMasterAdmin || league.userRoles.some(r => r.role === "LEAGUE_ADMIN");
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!league.stripeCustomerId)
    return NextResponse.json({ error: "No Stripe customer found for this league" }, { status: 400 });

  const origin = req.nextUrl.origin;

  const portalSession = await stripe.billingPortal.sessions.create({
    customer:   league.stripeCustomerId,
    return_url: `${origin}/league/${leagueSlug}`,
  });

  return NextResponse.json({ url: portalSession.url });
}
