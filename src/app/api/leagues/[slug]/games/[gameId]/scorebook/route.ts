import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ slug: string; gameId: string }> }

async function getGameAndLeague(slug: string, gameId: string) {
  const league = await prisma.league.findUnique({ where: { slug } });
  if (!league) return null;
  const game = await prisma.game.findFirst({
    where: { id: gameId, leagueId: league.id },
    include: {
      homeTeam: { select: { id: true, managerId: true, assistantId: true, players: { select: { userId: true } } } },
      awayTeam: { select: { id: true, managerId: true, assistantId: true, players: { select: { userId: true } } } },
    },
  });
  return game ? { league, game } : null;
}

export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, gameId } = await params;
  const ctx = await getGameAndLeague(slug, gameId);
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { game } = ctx;
  const teamId = new URL(req.url).searchParams.get("teamId");
  if (!teamId) return NextResponse.json({ error: "teamId required" }, { status: 400 });

  const userId      = session.user.id!;
  const isMasterAdmin = (session.user as any).isMasterAdmin;
  const isHomeTeam  = game.homeTeam.id === teamId;
  const team        = isHomeTeam ? game.homeTeam : game.awayTeam;

  if (!isMasterAdmin) {
    const isManager = team.managerId === userId || team.assistantId === userId;
    const isPlayer  = team.players.some(p => p.userId === userId);
    const leagueRole = await prisma.userLeagueRole.findFirst({
      where: { leagueId: ctx.league.id, userId, role: { in: ["LEAGUE_ADMIN", "UMPIRE", "SCOREKEEPER"] } },
    });
    if (!isManager && !isPlayer && !leagueRole)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const scorebook = await prisma.managerScorebook.findUnique({
    where: { gameId_teamId: { gameId, teamId } },
  });

  return NextResponse.json({ data: scorebook?.data ?? null });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, gameId } = await params;
  const ctx = await getGameAndLeague(slug, gameId);
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { game } = ctx;
  const { teamId, data } = await req.json();
  if (!teamId) return NextResponse.json({ error: "teamId required" }, { status: 400 });

  const userId      = session.user.id!;
  const isMasterAdmin = (session.user as any).isMasterAdmin;
  const isHomeTeam  = game.homeTeam.id === teamId;
  const team        = isHomeTeam ? game.homeTeam : game.awayTeam;

  if (!isMasterAdmin) {
    const isManager = team.managerId === userId || team.assistantId === userId;
    if (!isManager) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const scorebook = await prisma.managerScorebook.upsert({
    where: { gameId_teamId: { gameId, teamId } },
    update: { data },
    create: { gameId, teamId, data },
  });

  return NextResponse.json({ data: scorebook.data });
}
