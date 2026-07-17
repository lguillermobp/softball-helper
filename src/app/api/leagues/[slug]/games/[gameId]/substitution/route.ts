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

  const isAdmin  = isMasterAdmin || league.userRoles.some(r => r.role === "LEAGUE_ADMIN");
  const isScorer = league.userRoles.some(r => r.role === "SCOREKEEPER");
  if (!isAdmin && !isScorer) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (league.status === "SUSPENDED") return NextResponse.json({ error: "This league is currently suspended." }, { status: 423 });

  const game = await prisma.game.findFirst({
    where: { id: gameId, leagueId: league.id },
    include: {
      lineups: true,
      substitutions: true,
      season: { select: { reEntryAllowed: true, reEntryLimit: true } },
    },
  });
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });
  if (game.status !== "IN_PROGRESS") return NextResponse.json({ error: "Game is not in progress" }, { status: 409 });

  const { playerOutId, playerInId, battingOrderSpot, position, inningNumber, isTop } = await req.json();
  if (!playerOutId || !playerInId || battingOrderSpot == null || inningNumber == null || isTop == null)
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  if (playerOutId === playerInId)
    return NextResponse.json({ error: "Player in and player out must be different" }, { status: 400 });

  // Determine if this is a re-entry (playerIn was previously subbed out in this game)
  const prevSubOut = game.substitutions.some(s => s.playerOutId === playerInId);
  const isReEntry = prevSubOut;

  // Validate re-entry rules
  if (isReEntry) {
    if (!game.season.reEntryAllowed)
      return NextResponse.json({ error: "Re-entry is not allowed in this season" }, { status: 400 });

    const reEntryCount = game.substitutions.filter(s => s.playerInId === playerInId && s.isReEntry).length;
    if (reEntryCount >= game.season.reEntryLimit)
      return NextResponse.json({ error: `This player has reached the re-entry limit (${game.season.reEntryLimit})` }, { status: 400 });

    // Re-entry must be at the same batting order spot
    const originalSpot = game.lineups.find(l => l.playerId === playerInId)?.battingOrder;
    if (originalSpot != null && originalSpot !== battingOrderSpot)
      return NextResponse.json({ error: `Re-entry must be at batting order spot ${originalSpot}` }, { status: 400 });
  }

  // Determine team from playerOut's lineup entry
  const outLineup = game.lineups.find(l => l.playerId === playerOutId);
  if (!outLineup) return NextResponse.json({ error: "Player out is not in the lineup" }, { status: 400 });

  const sub = await prisma.gameSubstitution.create({
    data: {
      gameId,
      teamId: outLineup.isHome ? game.homeTeamId : game.awayTeamId,
      inningNumber,
      isTop,
      playerOutId,
      playerInId,
      battingOrderSpot,
      position: position ?? null,
      isReEntry,
    },
  });

  return NextResponse.json(sub);
}
