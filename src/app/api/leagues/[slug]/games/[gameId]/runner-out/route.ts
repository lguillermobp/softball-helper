import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ slug: string; gameId: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const { slug, gameId } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId        = session.user.id!;
  const isMasterAdmin = (session.user as any).isMasterAdmin as boolean;

  const [league, game] = await Promise.all([
    prisma.league.findUnique({ where: { slug }, include: { userRoles: { where: { userId } } } }),
    prisma.game.findFirst({ where: { id: gameId }, include: { officials: { select: { userId: true, role: true } } } }),
  ]);
  if (!league || !game || game.leagueId !== league.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin          = isMasterAdmin || league.userRoles.some(r => r.role === "LEAGUE_ADMIN");
  const isAssignedScorer = game.officials.some(o => o.userId === userId && o.role === "SCOREKEEPER");
  if (!isAdmin && !isAssignedScorer)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (game.status !== "IN_PROGRESS")
    return NextResponse.json({ error: "Game is not in progress" }, { status: 409 });

  const { inningNumber, isTop, sequence, carryOverBattingOrder } = await req.json();
  if (inningNumber == null || isTop == null || sequence == null)
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

  // Record the runner out event
  const runnerOut = await prisma.gameRunnerOut.create({
    data: { gameId, inningNumber, isTop, sequence },
  });

  // If there's a carry-over batter, persist it on the inning record
  if (carryOverBattingOrder != null) {
    await prisma.gameInning.upsert({
      where: { gameId_inningNumber_isTop: { gameId, inningNumber, isTop } },
      update: { carryOverBattingOrder },
      create: { gameId, inningNumber, isTop, runsScored: 0, completed: false, carryOverBattingOrder },
    });
  }

  return NextResponse.json(runnerOut);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { slug, gameId } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId        = session.user.id!;
  const isMasterAdmin = (session.user as any).isMasterAdmin as boolean;

  const [league, game] = await Promise.all([
    prisma.league.findUnique({ where: { slug }, include: { userRoles: { where: { userId } } } }),
    prisma.game.findFirst({ where: { id: gameId }, include: { officials: { select: { userId: true, role: true } } } }),
  ]);
  if (!league || !game || game.leagueId !== league.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin          = isMasterAdmin || league.userRoles.some(r => r.role === "LEAGUE_ADMIN");
  const isAssignedScorer = game.officials.some(o => o.userId === userId && o.role === "SCOREKEEPER");
  if (!isAdmin && !isAssignedScorer)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { runnerOutId } = await req.json();
  if (!runnerOutId) return NextResponse.json({ error: "runnerOutId is required" }, { status: 400 });

  await prisma.gameRunnerOut.delete({ where: { id: runnerOutId } });
  return NextResponse.json({ ok: true });
}
