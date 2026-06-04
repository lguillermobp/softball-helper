import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ slug: string; gameId: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
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

  const hasAnyRole = isMasterAdmin || league.userRoles.length > 0;
  if (!hasAnyRole) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const game = await prisma.game.findFirst({ where: { id: gameId, leagueId: league.id } });
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });
  if (!game.isPractice) return NextResponse.json({ error: "Only practice games can be reset" }, { status: 400 });

  await prisma.$transaction([
    prisma.gameAtBat.deleteMany({ where: { gameId } }),
    prisma.gameInning.deleteMany({ where: { gameId } }),
    prisma.gamePitcherStint.deleteMany({ where: { gameId } }),
    prisma.gameSubstitution.deleteMany({ where: { gameId } }),
    prisma.managerScorebook.deleteMany({ where: { gameId } }),
    prisma.gameLineup.deleteMany({ where: { gameId } }),
    prisma.game.update({
      where: { id: gameId },
      data: {
        status: "SCHEDULED",
        startedAt: null,
        lineupsLocked: false,
        homeScore: null,
        awayScore: null,
        cancelReason: null,
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
