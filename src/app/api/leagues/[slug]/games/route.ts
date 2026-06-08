import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ slug: string }> }

const gameInclude = {
  homeTeam: { select: { id: true, name: true } },
  awayTeam: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
  field:    { select: { id: true, name: true } },
} as const;

export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const { searchParams } = new URL(req.url);
  const seasonId = searchParams.get("seasonId");

  const league = await prisma.league.findUnique({ where: { slug } });
  if (!league) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const games = await prisma.game.findMany({
    where: { leagueId: league.id, ...(seasonId ? { seasonId } : {}) },
    include: gameInclude,
    orderBy: { scheduledAt: "asc" },
  });

  return NextResponse.json(games);
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const league = await prisma.league.findUnique({
    where: { slug },
    include: { userRoles: { where: { userId: session.user.id } } },
  });
  if (!league) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isMasterAdmin = (session.user as any).isMasterAdmin;
  const isAdmin = isMasterAdmin || league.userRoles.some((r) => r.role === "LEAGUE_ADMIN");
  const hasAnyRole = league.userRoles.length > 0;

  const { seasonId, categoryId, homeTeamId, awayTeamId, fieldId, scheduledAt, homeAwayTbd, isPractice, isTwin } =
    await req.json();

  // Practice games: any league member can create; regular games: admin only
  if (isPractice) {
    if (!isMasterAdmin && !hasAnyRole)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } else {
    if (!isAdmin)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!seasonId || !homeTeamId || !awayTeamId || !scheduledAt)
    return NextResponse.json(
      { error: "seasonId, homeTeamId, awayTeamId and scheduledAt are required" },
      { status: 400 }
    );

  if (homeTeamId === awayTeamId)
    return NextResponse.json({ error: "Home and away teams must be different" }, { status: 400 });

  const gameData = {
    leagueId:   league.id,
    seasonId,
    categoryId: categoryId || null,
    homeTeamId,
    awayTeamId,
    fieldId:    fieldId || null,
    homeAwayTbd: homeAwayTbd === true,
    isPractice:  isPractice  === true,
  };

  // Look up field defaults and season config (duration fallback + default officials)
  const [field, seasonCfg] = await Promise.all([
    fieldId
      ? prisma.field.findUnique({
          where: { id: fieldId },
          select: { slotDurationMins: true, defaultScorekeeperUserId: true, defaultUmpireUserId: true },
        })
      : Promise.resolve(null),
    prisma.season.findUnique({
      where: { id: seasonId },
      select: { defaultGameDurationMins: true },
    }),
  ]);

  async function addDefaultOfficials(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], gameId: string) {
    if (field?.defaultUmpireUserId) {
      await tx.gameOfficial.upsert({
        where: { gameId_userId: { gameId, userId: field.defaultUmpireUserId } },
        update: {},
        create: { gameId, userId: field.defaultUmpireUserId, role: "UMPIRE" },
      });
    }
    if (field?.defaultScorekeeperUserId) {
      await tx.gameOfficial.upsert({
        where: { gameId_userId: { gameId, userId: field.defaultScorekeeperUserId } },
        update: {},
        create: { gameId, userId: field.defaultScorekeeperUserId, role: "SCOREKEEPER" },
      });
    }
  }

  if (isTwin && !isPractice) {
    const durationMs = (field?.slotDurationMins ?? seasonCfg?.defaultGameDurationMins ?? 90) * 60 * 1000;
    const game1At = new Date(scheduledAt);
    const game2At = new Date(game1At.getTime() + durationMs);

    const [game1, game2] = await prisma.$transaction(async (tx) => {
      const g1 = await tx.game.create({ data: { ...gameData, scheduledAt: game1At }, include: gameInclude });
      const g2 = await tx.game.create({ data: { ...gameData, scheduledAt: game2At }, include: gameInclude });
      await addDefaultOfficials(tx, g1.id);
      await addDefaultOfficials(tx, g2.id);
      return [g1, g2];
    });
    return NextResponse.json([game1, game2], { status: 201 });
  }

  const game = await prisma.$transaction(async (tx) => {
    const g = await tx.game.create({ data: { ...gameData, scheduledAt: new Date(scheduledAt) }, include: gameInclude });
    await addDefaultOfficials(tx, g.id);
    return g;
  });

  return NextResponse.json(game, { status: 201 });
}
