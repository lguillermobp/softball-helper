import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ leagueId: string }> }

async function requireMasterAdmin() {
  const session = await auth();
  if (!(session?.user as any)?.isMasterAdmin) throw new Error("Forbidden");
}

// GET — subscription history for a league
export async function GET(_req: NextRequest, { params }: Params) {
  try { await requireMasterAdmin(); } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { leagueId } = await params;

  const [subscriptions, gamesCount] = await Promise.all([
    prisma.leagueSubscription.findMany({
      where: { leagueId },
      include: { plan: { select: { id: true, name: true, price: true, maxGames: true } } },
      orderBy: { startDate: "desc" },
    }),
    prisma.game.count({
      where: { leagueId, status: { notIn: ["CANCELLED", "RESCHEDULED"] } },
    }),
  ]);

  return NextResponse.json({ subscriptions, gamesCount });
}

// POST — create a manual subscription (admin override)
export async function POST(req: NextRequest, { params }: Params) {
  try { await requireMasterAdmin(); } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { leagueId } = await params;
  const { planId, startDate, endDate, maxGames, note } = await req.json();

  if (!planId || !startDate || !endDate || !maxGames)
    return NextResponse.json({ error: "planId, startDate, endDate, maxGames are required" }, { status: 400 });

  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  const league = await prisma.league.findUnique({ where: { id: leagueId } });
  if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });

  // Cancel any currently active subscription
  await prisma.leagueSubscription.updateMany({
    where: { leagueId, status: "ACTIVE" },
    data:  { status: "CANCELLED", cancelledAt: new Date() },
  });

  const sub = await prisma.leagueSubscription.create({
    data: {
      leagueId,
      planId,
      maxGames:  parseInt(maxGames),
      startDate: new Date(startDate),
      endDate:   new Date(endDate),
      status:    "ACTIVE",
      note:      note?.trim() || null,
    },
    include: { plan: { select: { id: true, name: true, price: true, maxGames: true } } },
  });

  return NextResponse.json(sub, { status: 201 });
}

// PATCH — edit an existing subscription
export async function PATCH(req: NextRequest, { params }: Params) {
  try { await requireMasterAdmin(); } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { leagueId } = await params;
  const { subscriptionId, planId, startDate, endDate, maxGames, status, note } = await req.json();

  if (!subscriptionId)
    return NextResponse.json({ error: "subscriptionId is required" }, { status: 400 });

  const existing = await prisma.leagueSubscription.findFirst({
    where: { id: subscriptionId, leagueId },
  });
  if (!existing) return NextResponse.json({ error: "Subscription not found" }, { status: 404 });

  const updated = await prisma.leagueSubscription.update({
    where: { id: subscriptionId },
    data: {
      ...(planId    && { planId }),
      ...(startDate && { startDate: new Date(startDate) }),
      ...(endDate   && { endDate:   new Date(endDate) }),
      ...(maxGames  && { maxGames:  parseInt(maxGames) }),
      ...(status    && { status }),
      ...(note !== undefined && { note: note?.trim() || null }),
      ...(status === "CANCELLED" && { cancelledAt: new Date() }),
    },
    include: { plan: { select: { id: true, name: true, price: true, maxGames: true } } },
  });

  return NextResponse.json(updated);
}
