import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ slug: string; gameId: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const { slug, gameId } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id!;
  const isMasterAdmin = (session.user as any).isMasterAdmin as boolean;

  const league = await prisma.league.findUnique({
    where: { slug },
    include: { userRoles: { where: { userId } } },
  });
  if (!league) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = isMasterAdmin || league.userRoles.some(r => r.role === "LEAGUE_ADMIN");
  const isScorer = league.userRoles.some(r => r.role === "SCOREKEEPER");
  if (!isAdmin && !isScorer) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const game = await prisma.game.findFirst({ where: { id: gameId, leagueId: league.id } });
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });
  if (game.status !== "IN_PROGRESS") return NextResponse.json({ error: "Game is not in progress" }, { status: 409 });

  const { outcome, batterId, pitcherId, inningNumber, isTop, sequence } = await req.json();
  if (!outcome || !batterId || !pitcherId || inningNumber == null || isTop == null || sequence == null)
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

  const validOutcomes = ["SINGLE", "DOUBLE", "TRIPLE", "HOME_RUN", "WALK", "OUT", "STRIKEOUT"];
  if (!validOutcomes.includes(outcome))
    return NextResponse.json({ error: "Invalid outcome" }, { status: 400 });

  const atBat = await prisma.gameAtBat.create({
    data: { gameId, inningNumber, isTop, batterId, pitcherId, outcome, sequence },
  });

  return NextResponse.json(atBat);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { slug, gameId } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id!;
  const isMasterAdmin = (session.user as any).isMasterAdmin as boolean;

  const league = await prisma.league.findUnique({
    where: { slug },
    include: { userRoles: { where: { userId } } },
  });
  if (!league) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = isMasterAdmin || league.userRoles.some(r => r.role === "LEAGUE_ADMIN");
  const isScorer = league.userRoles.some(r => r.role === "SCOREKEEPER");
  if (!isAdmin && !isScorer) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { atBatId } = await req.json();
  if (!atBatId) return NextResponse.json({ error: "atBatId is required" }, { status: 400 });

  // Only allow undoing the very last at-bat of the game
  const last = await prisma.gameAtBat.findFirst({
    where: { gameId },
    orderBy: { createdAt: "desc" },
  });
  if (!last || last.id !== atBatId)
    return NextResponse.json({ error: "Only the last at-bat can be undone" }, { status: 400 });

  await prisma.gameAtBat.delete({ where: { id: atBatId } });
  return NextResponse.json({ ok: true });
}
