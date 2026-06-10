import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ slug: string; gameId: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const { slug, gameId } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id!;
  const isMasterAdmin = (session.user as any).isMasterAdmin as boolean;

  const league = await prisma.league.findUnique({
    where: { slug },
    include: { userRoles: { where: { userId } } },
  });
  if (!league) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = isMasterAdmin || league.userRoles.some(r => r.role === "LEAGUE_ADMIN");

  const game = await prisma.game.findFirst({
    where: { id: gameId, leagueId: league.id },
    include: {
      innings:   true,
      officials: { select: { userId: true, role: true } },
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
    data: {
      status: "COMPLETED",
      hasStats: true,
      homeScore: homeRuns,
      awayScore: awayRuns,
    },
  });

  return NextResponse.json({ ok: true, status: "COMPLETED", homeScore: homeRuns, awayScore: awayRuns });
}
