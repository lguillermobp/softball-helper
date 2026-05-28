import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ slug: string; gameId: string }> }

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

  const isAdmin = isMasterAdmin || league.userRoles.some(r => r.role === "LEAGUE_ADMIN");
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const original = await prisma.game.findFirst({ where: { id: gameId, leagueId: league.id } });
  if (!original) return NextResponse.json({ error: "Game not found" }, { status: 404 });
  if (original.status !== "SCHEDULED")
    return NextResponse.json({ error: "Only scheduled games can be rescheduled" }, { status: 409 });

  const {
    willBePlayed,
    homeTeamId, awayTeamId,
    scheduledAt,
    fieldId,
    categoryId,
    homeAwayTbd,
  } = await req.json() as {
    willBePlayed: boolean;
    homeTeamId: string;
    awayTeamId: string;
    scheduledAt: string;
    fieldId: string | null;
    categoryId: string | null;
    homeAwayTbd: boolean;
  };

  if (!homeTeamId || !awayTeamId || !scheduledAt)
    return NextResponse.json({ error: "homeTeamId, awayTeamId, and scheduledAt are required" }, { status: 400 });

  if (homeTeamId === awayTeamId)
    return NextResponse.json({ error: "Home and away teams must be different" }, { status: 400 });

  // Run both operations atomically
  const [updatedOriginal, newGame] = await prisma.$transaction([
    prisma.game.update({
      where: { id: gameId },
      data: { status: willBePlayed ? "RESCHEDULED" : "CANCELLED" },
    }),
    prisma.game.create({
      data: {
        leagueId:          league.id,
        seasonId:          original.seasonId,
        homeTeamId,
        awayTeamId,
        scheduledAt:       new Date(scheduledAt),
        fieldId:           fieldId || null,
        categoryId:        categoryId || null,
        homeAwayTbd:       homeAwayTbd === true,
        rescheduledFromId: gameId,
        status:            "SCHEDULED",
      },
      include: {
        homeTeam: { select: { id: true, name: true } },
        awayTeam:  { select: { id: true, name: true } },
        field:    { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
      },
    }),
  ]);

  return NextResponse.json({ original: updatedOriginal, newGame }, { status: 201 });
}
