import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ slug: string; gameId: string }> }

const MIN_BATTERS = 9;

function isLineupComplete(lineups: { position: string; battingOrder: number | null; isHome: boolean }[], isHome: boolean): boolean {
  const side = lineups.filter(l => l.isHome === isHome && l.position !== "B");
  if (side.length < MIN_BATTERS) return false;
  const orders = side.map(l => l.battingOrder as number).filter(Boolean).sort((a, b) => a - b);
  if (orders.length < MIN_BATTERS) return false;
  for (let i = 0; i < orders.length; i++) {
    if (orders[i] !== i + 1) return false;
  }
  return true;
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, gameId } = await params;
  const isMasterAdmin = (session.user as any).isMasterAdmin as boolean;
  const userId = session.user.id!;

  const league = await prisma.league.findUnique({
    where: { slug },
    include: { userRoles: { where: { userId } } },
  });
  if (!league) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin  = isMasterAdmin || league.userRoles.some(r => r.role === "LEAGUE_ADMIN");
  const isUmpire = league.userRoles.some(r => r.role === "UMPIRE");

  const game = await prisma.game.findFirst({
    where: { id: gameId, leagueId: league.id },
    include: {
      officials: true,
      lineups: true,
    },
  });
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  const isAssignedScorer = game.officials.some(o => o.userId === userId && o.role === "SCOREKEEPER");
  if (!isAdmin && !isUmpire && !isAssignedScorer)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (game.status !== "SCHEDULED")
    return NextResponse.json({ error: "Only scheduled games can be started" }, { status: 409 });

  // Validation
  const errors: string[] = [];

  const umpires = game.officials.filter(o => o.role === "UMPIRE");
  if (umpires.length < 1) errors.push("At least 1 umpire is required");

  const scorer = game.officials.find(o => o.role === "SCOREKEEPER");
  if (!scorer) errors.push("A scorekeeper is required");

  if (!isLineupComplete(game.lineups, true))
    errors.push("Home team lineup is incomplete (minimum 9 batters required)");

  if (!isLineupComplete(game.lineups, false))
    errors.push("Away team lineup is incomplete (minimum 9 batters required)");

  if (errors.length > 0)
    return NextResponse.json({ error: errors.join("; "), errors }, { status: 400 });

  const updated = await prisma.game.update({
    where: { id: gameId },
    data: { status: "IN_PROGRESS", startedAt: new Date(), lineupsLocked: true },
    include: {
      homeTeam: { select: { id: true, name: true } },
      awayTeam: { select: { id: true, name: true } },
      field: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(updated);
}
