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

  const { seasonId, categoryId, homeTeamId, awayTeamId, fieldId, scheduledAt, homeAwayTbd, isPractice } =
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

  const game = await prisma.game.create({
    data: {
      leagueId: league.id,
      seasonId,
      categoryId: categoryId || null,
      homeTeamId,
      awayTeamId,
      fieldId: fieldId || null,
      scheduledAt: new Date(scheduledAt),
      homeAwayTbd: homeAwayTbd === true,
      isPractice:  isPractice  === true,
    },
    include: gameInclude,
  });

  return NextResponse.json(game, { status: 201 });
}
