import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendGameEndNotification, sendManagerGameEndNotification } from "@/lib/email";
import { autoPostGameScoreCard } from "@/lib/ig-auto-post";

interface Params { params: Promise<{ slug: string; gameId: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const { slug, gameId } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id!;
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

  const isAdmin = isMasterAdmin || league.userRoles.some(r => r.role === "LEAGUE_ADMIN");

  const game = await prisma.game.findFirst({
    where: { id: gameId, leagueId: league.id },
    include: {
      innings:   true,
      officials: { select: { userId: true, role: true } },
      homeTeam:  { select: { name: true, logoUrl: true, manager: { select: { email: true, name: true } }, assistant: { select: { email: true, name: true } } } },
      awayTeam:  { select: { name: true, logoUrl: true, manager: { select: { email: true, name: true } }, assistant: { select: { email: true, name: true } } } },
      field:     { select: { name: true } },
      season:    { select: { name: true } },
    },
  });
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  const isAssignedScorer = game.officials.some(o => o.userId === userId && o.role === "SCOREKEEPER");
  if (!isAdmin && !isAssignedScorer) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (game.status !== "IN_PROGRESS")
    return NextResponse.json({ error: "Game is not in progress" }, { status: 409 });

  const body = await req.json();
  const { outcome, cancelReason } = body as { outcome: "official" | "cancelled"; cancelReason?: string };

  if (outcome === "cancelled") {
    if (!cancelReason?.trim())
      return NextResponse.json({ error: "A cancellation reason is required" }, { status: 400 });

    await prisma.game.update({
      where: { id: gameId },
      data: { status: "CANCELLED", cancelReason: cancelReason.trim() },
    });
    return NextResponse.json({ ok: true, status: "CANCELLED" });
  }

  // Official completion — compute final scores from innings
  const homeRuns = game.innings.filter(i => !i.isTop).reduce((s, i) => s + i.runsScored, 0);
  const awayRuns = game.innings.filter(i => i.isTop).reduce((s, i) => s + i.runsScored, 0);

  await prisma.game.update({
    where: { id: gameId },
    data: { status: "COMPLETED", hasStats: true, homeScore: homeRuns, awayScore: awayRuns },
  });

  // Fire notifications (non-blocking — failure must not break the response)
  if (league.notifyGameEnd && league.notifyEmail) {
    sendGameEndNotification({
      to: league.notifyEmail,
      leagueName: league.name,
      homeTeam: game.homeTeam.name,
      awayTeam: game.awayTeam.name,
      homeScore: homeRuns,
      awayScore: awayRuns,
      scheduledAt: game.scheduledAt,
      fieldName: game.field?.name ?? null,
    }).catch(err => console.error("[notify] game end email failed:", err));
  }

  if (league.notifyManagers) {
    const staffToNotify: { email: string; name: string | null; myTeam: string; opponentTeam: string; myScore: number; opponentScore: number }[] = [];
    if (game.homeTeam.manager?.email) staffToNotify.push({ email: game.homeTeam.manager.email, name: game.homeTeam.manager.name, myTeam: game.homeTeam.name, opponentTeam: game.awayTeam.name, myScore: homeRuns, opponentScore: awayRuns });
    if (game.homeTeam.assistant?.email) staffToNotify.push({ email: game.homeTeam.assistant.email, name: game.homeTeam.assistant.name, myTeam: game.homeTeam.name, opponentTeam: game.awayTeam.name, myScore: homeRuns, opponentScore: awayRuns });
    if (game.awayTeam.manager?.email) staffToNotify.push({ email: game.awayTeam.manager.email, name: game.awayTeam.manager.name, myTeam: game.awayTeam.name, opponentTeam: game.homeTeam.name, myScore: awayRuns, opponentScore: homeRuns });
    if (game.awayTeam.assistant?.email) staffToNotify.push({ email: game.awayTeam.assistant.email, name: game.awayTeam.assistant.name, myTeam: game.awayTeam.name, opponentTeam: game.homeTeam.name, myScore: awayRuns, opponentScore: homeRuns });

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
      leagueName:      league.name,
      leagueLogoUrl:   league.logoUrl,
      timezone:        league.timezone,
      seasonName:      game.season?.name ?? "",
      homeTeam:        game.homeTeam.name,
      awayTeam:        game.awayTeam.name,
      homeScore:       homeRuns,
      awayScore:       awayRuns,
      homeLogoUrl:     game.homeTeam.logoUrl,
      awayLogoUrl:     game.awayTeam.logoUrl,
      scheduledAt:     game.scheduledAt,
      protestStatus:   game.protestStatus,
      protestTeamName: game.protestTeamId
        ? (game.protestTeamId === game.homeTeamId ? game.homeTeam.name : game.awayTeam.name)
        : null,
    }).catch(err => console.error("[ig-auto-post] game end failed:", err));
  }

  return NextResponse.json({ ok: true, status: "COMPLETED", homeScore: homeRuns, awayScore: awayRuns });
}
