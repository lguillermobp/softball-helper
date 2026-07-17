import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ slug: string; seasonId: string }> }

async function getAdminLeague(slug: string, userId: string, isMasterAdmin: boolean) {
  const league = await prisma.league.findUnique({
    where: { slug },
    include: { userRoles: { where: { userId } } },
  });
  if (!league) return null;
  const isAdmin = isMasterAdmin || league.userRoles.some(r => r.role === "LEAGUE_ADMIN");
  if (!isAdmin) return null;
  return league;
}

function dayRange(date: string) {
  return {
    gte: new Date(`${date}T00:00:00.000Z`),
    lte: new Date(`${date}T23:59:59.999Z`),
  };
}

export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, seasonId } = await params;
  const isMasterAdmin = (session.user as any).isMasterAdmin as boolean;
  const userId = session.user.id!;

  const league = await getAdminLeague(slug, userId, isMasterAdmin);
  if (!league) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (league.status === "SUSPENDED") return NextResponse.json({ error: "This league is currently suspended." }, { status: 423 });

  const date = req.nextUrl.searchParams.get("date");
  const fieldId = req.nextUrl.searchParams.get("fieldId") || null;
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  const games = await prisma.game.findMany({
    where: {
      seasonId,
      leagueId: league.id,
      status: "SCHEDULED",
      scheduledAt: dayRange(date),
      ...(fieldId ? { fieldId } : {}),
    },
    select: {
      id: true,
      scheduledAt: true,
      homeTeam: { select: { id: true, name: true } },
      awayTeam: { select: { id: true, name: true } },
      field: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
    },
    orderBy: { scheduledAt: "asc" },
  });

  return NextResponse.json({ games });
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, seasonId } = await params;
  const isMasterAdmin = (session.user as any).isMasterAdmin as boolean;
  const userId = session.user.id!;

  const league = await getAdminLeague(slug, userId, isMasterAdmin);
  if (!league) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (league.status === "SUSPENDED") return NextResponse.json({ error: "This league is currently suspended." }, { status: 423 });

  const body = await req.json() as { date: string; fieldId?: string | null; newDate: string };
  const { date, fieldId, newDate } = body;

  if (!date || !newDate) return NextResponse.json({ error: "date and newDate required" }, { status: 400 });
  if (date === newDate) return NextResponse.json({ error: "New date must differ from original date" }, { status: 400 });

  const offsetMs =
    new Date(`${newDate}T00:00:00.000Z`).getTime() -
    new Date(`${date}T00:00:00.000Z`).getTime();

  const originals = await prisma.game.findMany({
    where: {
      seasonId,
      leagueId: league.id,
      status: "SCHEDULED",
      scheduledAt: dayRange(date),
      ...(fieldId ? { fieldId } : {}),
    },
  });

  if (originals.length === 0) {
    return NextResponse.json({ error: "No scheduled games found on that date" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.game.updateMany({
      where: { id: { in: originals.map(g => g.id) } },
      data: { status: "RESCHEDULED" },
    }),
    ...originals.map(g =>
      prisma.game.create({
        data: {
          leagueId:          league.id,
          seasonId:          g.seasonId,
          homeTeamId:        g.homeTeamId,
          awayTeamId:        g.awayTeamId,
          fieldId:           g.fieldId,
          categoryId:        g.categoryId,
          scheduledAt:       new Date(g.scheduledAt.getTime() + offsetMs),
          homeAwayTbd:       g.homeAwayTbd,
          hasStats:          g.hasStats,
          isPractice:        g.isPractice,
          rescheduledFromId: g.id,
          status:            "SCHEDULED",
        },
      })
    ),
  ]);

  return NextResponse.json({ rescheduled: originals.length }, { status: 201 });
}
