import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ slug: string; gameId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
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
  if (league.status === "SUSPENDED") return NextResponse.json({ error: "This league is currently suspended." }, { status: 423 });

  const isAdmin       = isMasterAdmin || league.userRoles.some(r => r.role === "LEAGUE_ADMIN");
  const isUmpire      = league.userRoles.some(r => r.role === "UMPIRE");
  const isScorekeeper = league.userRoles.some(r => r.role === "SCOREKEEPER");

  if (!isAdmin && !isUmpire && !isScorekeeper)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const game = await prisma.game.findFirst({ where: { id: gameId, leagueId: league.id } });
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });
  if (game.status === "COMPLETED" || game.status === "CANCELLED")
    return NextResponse.json({ error: "Cannot modify a completed or cancelled game" }, { status: 409 });

  const { action } = await req.json() as { action: "swap" | "confirm" };

  if (action === "swap") {
    // Swap home ↔ away teams and flip all lineup isHome values in one transaction
    await prisma.$transaction([
      prisma.game.update({
        where: { id: gameId },
        data: {
          homeTeamId:  game.awayTeamId,
          awayTeamId:  game.homeTeamId,
          homeAwayTbd: false,
        },
      }),
      prisma.$executeRaw`UPDATE game_lineups SET "isHome" = NOT "isHome" WHERE "gameId" = ${gameId}`,
    ]);
  } else if (action === "confirm") {
    await prisma.game.update({
      where: { id: gameId },
      data: { homeAwayTbd: false },
    });
  } else {
    return NextResponse.json({ error: "Invalid action — use 'swap' or 'confirm'" }, { status: 400 });
  }

  const updated = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      homeTeam: { select: { id: true, name: true } },
      awayTeam:  { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(updated);
}
