import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit, getRequestMeta } from "@/lib/audit";
import { sendGameEndNotification } from "@/lib/email";

interface Params { params: Promise<{ slug: string; gameId: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const { slug, gameId } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId       = session.user.id!;
  const isMasterAdmin = (session.user as any).isMasterAdmin as boolean;

  const league = await prisma.league.findUnique({
    where: { slug },
    select: {
      id: true, name: true,
      notifyGameEnd: true, notifyEmail: true,
      userRoles: { where: { userId }, select: { role: true } },
    },
  });
  if (!league) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const role      = league.userRoles[0]?.role;
  const isAdmin   = isMasterAdmin || role === "LEAGUE_ADMIN";
  const isScorer  = role === "SCOREKEEPER";
  if (!isAdmin && !isScorer) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const game = await prisma.game.findFirst({
    where: { id: gameId, leagueId: league.id },
    include: {
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
      field:    { select: { name: true } },
    },
  });
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });
  if (game.status !== "SCHEDULED") return NextResponse.json({ error: "Game must be in SCHEDULED status" }, { status: 400 });

  const { homeScore, awayScore } = await req.json();
  if (typeof homeScore !== "number" || typeof awayScore !== "number" || homeScore < 0 || awayScore < 0)
    return NextResponse.json({ error: "Valid scores are required" }, { status: 400 });

  const updated = await prisma.game.update({
    where: { id: gameId },
    data: { homeScore, awayScore, status: "COMPLETED", hasStats: false },
  });

  await logAudit({
    actor: session.user as any,
    action: "game.record_result",
    entityType: "Game",
    entityId: gameId,
    leagueId: league.id,
    leagueName: league.name,
    metadata: { homeScore, awayScore },
    ...getRequestMeta(req),
  });

  if (league.notifyGameEnd && league.notifyEmail) {
    sendGameEndNotification({
      to: league.notifyEmail,
      leagueName: league.name,
      homeTeam: game.homeTeam.name,
      awayTeam: game.awayTeam.name,
      homeScore,
      awayScore,
      scheduledAt: game.scheduledAt,
      fieldName: game.field?.name ?? null,
    }).catch(err => console.error("[notify] game end email failed:", err));
  }

  return NextResponse.json(updated);
}
