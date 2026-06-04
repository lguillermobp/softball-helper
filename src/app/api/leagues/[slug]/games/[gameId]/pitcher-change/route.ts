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
  const isScorer = league.userRoles.some(r => r.role === "SCOREKEEPER");
  if (!isAdmin && !isScorer) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const game = await prisma.game.findFirst({ where: { id: gameId, leagueId: league.id } });
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });
  if (game.status !== "IN_PROGRESS") return NextResponse.json({ error: "Game is not in progress" }, { status: 409 });

  const { pitcherId, isHome, inningNumber, isTop, outsAtChange } = await req.json();
  if (!pitcherId || isHome == null || inningNumber == null || isTop == null || outsAtChange == null)
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

  const newStint = await prisma.$transaction(async (tx) => {
    await tx.gamePitcherStint.updateMany({
      where: { gameId, isHome, outsAtEnd: null },
      data: { inningEnd: inningNumber, isTopEnd: isTop, outsAtEnd: outsAtChange },
    });
    return tx.gamePitcherStint.create({
      data: { gameId, pitcherId, isHome, inningStart: inningNumber, isTopStart: isTop, outsAtStart: outsAtChange },
      include: { pitcher: { select: { id: true, name: true, jerseyNumber: true } } },
    });
  });

  return NextResponse.json(newStint);
}
