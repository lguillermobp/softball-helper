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

  const { inningNumber, isTop, runsScored } = await req.json();
  if (inningNumber == null || isTop == null || runsScored == null)
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  if (typeof runsScored !== "number" || runsScored < 0)
    return NextResponse.json({ error: "runsScored must be a non-negative number" }, { status: 400 });

  const inning = await prisma.gameInning.upsert({
    where: { gameId_inningNumber_isTop: { gameId, inningNumber, isTop } },
    update: { runsScored, completed: true },
    create: { gameId, inningNumber, isTop, runsScored, completed: true },
  });

  return NextResponse.json(inning);
}
