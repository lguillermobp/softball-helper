import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit, getRequestMeta } from "@/lib/audit";
import { sendGameEndNotification, sendManagerGameEndNotification } from "@/lib/email";
import { autoPostGameScoreCard } from "@/lib/ig-auto-post";

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
      id: true, name: true, logoUrl: true,
      notifyGameEnd: true, notifyEmail: true,
      notifyManagers: true, instagramEnabled: true, timezone: true,
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
    select: {
      scheduledAt: true, status: true, protestStatus: true,
      protestTeamId: true, homeTeamId: true, awayTeamId: true,
      homeTeam: { select: { name: true, logoUrl: true, manager: { select: { email: true, name: true } }, assistant: { select: { email: true, name: true } } } },
      awayTeam: { select: { name: true, logoUrl: true, manager: { select: { email: true, name: true } }, assistant: { select: { email: true, name: true } } } },
      field:    { select: { name: true } },
      season:   { select: { name: true } },
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

  if (league.notifyManagers) {
    const staffToNotify: { email: string; name: string | null; myTeam: string; opponentTeam: string; myScore: number; opponentScore: number }[] = [];
    if (game.homeTeam.manager?.email) staffToNotify.push({ email: game.homeTeam.manager.email, name: game.homeTeam.manager.name, myTeam: game.homeTeam.name, opponentTeam: game.awayTeam.name, myScore: homeScore, opponentScore: awayScore });
    if (game.homeTeam.assistant?.email) staffToNotify.push({ email: game.homeTeam.assistant.email, name: game.homeTeam.assistant.name, myTeam: game.homeTeam.name, opponentTeam: game.awayTeam.name, myScore: homeScore, opponentScore: awayScore });
    if (game.awayTeam.manager?.email) staffToNotify.push({ email: game.awayTeam.manager.email, name: game.awayTeam.manager.name, myTeam: game.awayTeam.name, opponentTeam: game.homeTeam.name, myScore: awayScore, opponentScore: homeScore });
    if (game.awayTeam.assistant?.email) staffToNotify.push({ email: game.awayTeam.assistant.email, name: game.awayTeam.assistant.name, myTeam: game.awayTeam.name, opponentTeam: game.homeTeam.name, myScore: awayScore, opponentScore: homeScore });

    for (const s of staffToNotify) {
      sendManagerGameEndNotification({
        to: s.email,
        managerName: s.name,
        leagueName: league.name,
        myTeam: s.myTeam,
        opponentTeam: s.opponentTeam,
        myScore: s.myScore,
        opponentScore: s.opponentScore,
        scheduledAt: game.scheduledAt,
        fieldName: game.field?.name ?? null,
      }).catch(err => console.error("[notify] manager email failed:", err));
    }
  }

  if (league.instagramEnabled) {
    autoPostGameScoreCard({
      leagueName:    league.name,
      leagueLogoUrl: league.logoUrl,
      timezone:      league.timezone,
      seasonName:    game.season?.name ?? "",
      homeTeam:      game.homeTeam.name,
      awayTeam:      game.awayTeam.name,
      homeScore,
      awayScore,
      homeLogoUrl:     game.homeTeam.logoUrl,
      awayLogoUrl:     game.awayTeam.logoUrl,
      scheduledAt:     game.scheduledAt,
      protestStatus:   game.protestStatus,
      protestTeamName: game.protestTeamId
        ? (game.protestTeamId === game.homeTeamId ? game.homeTeam.name : game.awayTeam.name)
        : null,
    }).catch(err => console.error("[ig-auto-post] record-result failed:", err));
  }

  return NextResponse.json(updated);
}
