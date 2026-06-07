import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit, getRequestMeta } from "@/lib/audit";

interface Params { params: Promise<{ slug: string; gameId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
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

  const isAdmin = isMasterAdmin || league.userRoles.some(r => r.role === "LEAGUE_ADMIN");
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const game = await prisma.game.findFirst({ where: { id: gameId, leagueId: league.id } });
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });
  if (game.status !== "COMPLETED") return NextResponse.json({ error: "Game is not completed" }, { status: 400 });

  const { homeScore, awayScore } = await req.json();
  if (typeof homeScore !== "number" || typeof awayScore !== "number" || homeScore < 0 || awayScore < 0)
    return NextResponse.json({ error: "Invalid scores" }, { status: 400 });

  const updated = await prisma.game.update({
    where: { id: gameId },
    data: { homeScore, awayScore },
  });

  await logAudit({
    actor: session.user as any,
    action: "game.edit_result",
    entityType: "Game",
    entityId: gameId,
    leagueId: league.id,
    leagueName: league.name,
    metadata: { homeScore, awayScore },
    ...getRequestMeta(req),
  });

  return NextResponse.json({ ok: true, homeScore: updated.homeScore, awayScore: updated.awayScore });
}
