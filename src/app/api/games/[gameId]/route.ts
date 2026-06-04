import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ gameId: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { gameId } = await params;

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      homeTeam: { select: { id: true, name: true, logoUrl: true } },
      awayTeam: { select: { id: true, name: true, logoUrl: true } },
      field:    { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
      officials: { include: { user: { select: { id: true, name: true } } } },
      lineups: {
        include: {
          player: { select: { id: true, name: true, jerseyNumber: true, photoUrl: true, nationality: true } },
        },
        orderBy: { battingOrder: "asc" },
      },
      innings: { orderBy: [{ inningNumber: "asc" }, { isTop: "desc" }] },
      atBats:  { orderBy: [{ inningNumber: "asc" }, { isTop: "desc" }, { sequence: "asc" }] },
      pitcherStints: {
        include: { pitcher: { select: { id: true, name: true, jerseyNumber: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!game) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Compute current outs in the active half-inning
  const completedInnings = game.innings.filter(i => i.completed);
  const lastCompleted = completedInnings[completedInnings.length - 1];
  const currentInning = lastCompleted
    ? (lastCompleted.isTop ? { inningNumber: lastCompleted.inningNumber, isTop: false } : { inningNumber: lastCompleted.inningNumber + 1, isTop: true })
    : { inningNumber: 1, isTop: true };

  const currentAtBats = game.atBats.filter(
    ab => ab.inningNumber === currentInning.inningNumber && ab.isTop === currentInning.isTop
  );
  const currentOuts = currentAtBats.filter(ab => ab.outcome === "OUT" || ab.outcome === "STRIKEOUT").length;

  // Active pitcher for each side
  const activePitcherHome = game.pitcherStints.find(s => s.isHome && s.outsAtEnd == null);
  const activePitcherAway = game.pitcherStints.find(s => !s.isHome && s.outsAtEnd == null);

  // Score from innings
  const homeScore = game.homeScore ?? game.innings.filter(i => !i.isTop).reduce((s, i) => s + i.runsScored, 0);
  const awayScore = game.awayScore ?? game.innings.filter(i => i.isTop).reduce((s, i) => s + i.runsScored, 0);

  return NextResponse.json({
    id: game.id,
    status: game.status,
    scheduledAt: game.scheduledAt.toISOString(),
    startedAt: game.startedAt?.toISOString() ?? null,
    cancelReason: game.cancelReason,
    homeScore,
    awayScore,
    homeTeam: game.homeTeam,
    awayTeam: game.awayTeam,
    field: game.field,
    category: game.category,
    officials: game.officials.map(o => ({ role: o.role, name: o.user.name })),
    lineups: game.lineups.map(l => ({
      isHome: l.isHome,
      battingOrder: l.battingOrder,
      position: l.position,
      player: l.player,
    })),
    innings: game.innings,
    atBats: game.atBats,
    currentInning,
    currentOuts,
    activePitcherHome: activePitcherHome ? activePitcherHome.pitcher : null,
    activePitcherAway: activePitcherAway ? activePitcherAway.pitcher : null,
  });
}
