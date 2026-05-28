import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ slug: string; gameId: string }> }

const UNIQUE_POSITIONS = ["P", "C", "1B", "2B", "3B", "SS", "SF", "LF", "CF", "RF", "DH"];
const VALID_POSITIONS = [...UNIQUE_POSITIONS, "EH", "B"];
const MIN_BATTERS = 9;

function validateLineup(entries: { position: string; battingOrder: number | null }[]): string | null {
  const active = entries.filter(e => e.position !== "B");

  // Check all positions are valid
  if (!entries.every(e => VALID_POSITIONS.includes(e.position)))
    return "Invalid position value";

  // Check unique positions (not EH) have no duplicates
  const uniquePosEntries = active.filter(e => UNIQUE_POSITIONS.includes(e.position));
  const posSet = new Set(uniquePosEntries.map(e => e.position));
  if (posSet.size !== uniquePosEntries.length)
    return "Duplicate position in lineup";

  // All active (non-B) players need batting order
  if (!active.every(e => typeof e.battingOrder === "number" && e.battingOrder > 0))
    return "All active players need a batting order number";

  // Batting order sequential with no gaps
  const orders = active.map(e => e.battingOrder as number).sort((a, b) => a - b);
  for (let i = 0; i < orders.length; i++) {
    if (orders[i] !== i + 1) return "Batting order must be sequential with no gaps";
  }

  // Min 9 batters
  if (orders.length < MIN_BATTERS)
    return `Minimum ${MIN_BATTERS} batters required (currently ${orders.length})`;

  return null;
}

export async function PUT(req: NextRequest, { params }: Params) {
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

  const game = await prisma.game.findFirst({
    where: { id: gameId, leagueId: league.id },
    include: {
      homeTeam: { select: { id: true, managerId: true, assistantId: true } },
      awayTeam:  { select: { id: true, managerId: true, assistantId: true } },
    },
  });
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });
  if (game.status === "COMPLETED" || game.status === "CANCELLED")
    return NextResponse.json({ error: "Cannot edit a completed or cancelled game" }, { status: 409 });

  const isAdmin = isMasterAdmin || league.userRoles.some(r => r.role === "LEAGUE_ADMIN");
  const isUmpire = league.userRoles.some(r => r.role === "UMPIRE");
  const isScorer = league.userRoles.some(r => r.role === "SCOREKEEPER");
  const isHomeManager = game.homeTeam.managerId === userId || game.homeTeam.assistantId === userId;
  const isAwayManager = game.awayTeam.managerId === userId || game.awayTeam.assistantId === userId;

  const { isHome, entries } = await req.json() as {
    isHome: boolean;
    entries: { playerId: string; position: string; battingOrder: number | null }[];
  };

  // Role check
  const canEditPreGame = isAdmin || isUmpire || (isHome ? isHomeManager : isAwayManager);
  const canEditInGame = isAdmin || isScorer;

  if (game.status === "SCHEDULED" && !canEditPreGame)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (game.status === "IN_PROGRESS" && !canEditInGame)
    return NextResponse.json({ error: "Forbidden — only admin or scorekeeper can edit in-game lineups" }, { status: 403 });

  // Validate lineup
  const validationError = validateLineup(entries);
  if (validationError)
    return NextResponse.json({ error: validationError }, { status: 400 });

  // Verify all players belong to the correct team
  const expectedTeamId = isHome ? game.homeTeamId : game.awayTeamId;
  const playerIds = entries.map(e => e.playerId);
  const players = await prisma.player.findMany({
    where: { id: { in: playerIds }, teamId: expectedTeamId },
    select: { id: true },
  });
  if (players.length !== playerIds.length)
    return NextResponse.json({ error: "Some players do not belong to this team" }, { status: 400 });

  // Replace lineup for this side
  await prisma.$transaction([
    prisma.gameLineup.deleteMany({ where: { gameId, isHome } }),
    prisma.gameLineup.createMany({
      data: entries.map(e => ({
        gameId,
        playerId: e.playerId,
        isHome,
        position: e.position,
        battingOrder: e.battingOrder ?? null,
      })),
    }),
  ]);

  return NextResponse.json({ success: true });
}
