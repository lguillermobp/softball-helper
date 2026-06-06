import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit, getRequestMeta } from "@/lib/audit";

interface Params { params: Promise<{ slug: string; gameId: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const { slug, gameId } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId        = session.user.id!;
  const isMasterAdmin = (session.user as any).isMasterAdmin as boolean;

  const league = await prisma.league.findUnique({
    where: { slug },
    include: { userRoles: { where: { userId } } },
  });
  if (!league) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const role    = league.userRoles[0]?.role;
  const isAdmin = isMasterAdmin || role === "LEAGUE_ADMIN";
  if (!isAdmin) return NextResponse.json({ error: "Forbidden — league admin only" }, { status: 403 });

  const game = await prisma.game.findFirst({ where: { id: gameId, leagueId: league.id } });
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });
  if (game.status !== "COMPLETED" || game.hasStats)
    return NextResponse.json({ error: "Only completed result-only games can be reopened" }, { status: 400 });

  const updated = await prisma.game.update({
    where: { id: gameId },
    data: { status: "IN_PROGRESS", hasStats: false },
  });

  await logAudit({
    actor: session.user as any,
    action: "game.reopen_for_stats",
    entityType: "Game",
    entityId: gameId,
    leagueId: league.id,
    leagueName: league.name,
    metadata: {},
    ...getRequestMeta(req),
  });

  return NextResponse.json(updated);
}
