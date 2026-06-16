import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ slug: string; gameId: string }> }

async function resolveAdminGame(slug: string, gameId: string, userId: string, isMasterAdmin: boolean) {
  const league = await prisma.league.findUnique({
    where: { slug },
    include: { userRoles: { where: { userId } } },
  });
  if (!league) return { error: "Not found", status: 404 } as const;

  const isAdmin = isMasterAdmin || league.userRoles.some((r) => r.role === "LEAGUE_ADMIN");
  if (!isAdmin) return { error: "Forbidden", status: 403 } as const;

  const game = await prisma.game.findFirst({ where: { id: gameId, leagueId: league.id } });
  if (!game) return { error: "Game not found", status: 404 } as const;
  if (game.status !== "COMPLETED") return { error: "Game is not completed", status: 400 } as const;

  return { league, game };
}

// POST /api/leagues/[slug]/games/[gameId]/protest — file a protest
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, gameId } = await params;
  const isMasterAdmin = (session.user as any).isMasterAdmin;
  const result = await resolveAdminGame(slug, gameId, session.user.id!, isMasterAdmin);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  const { game } = result;
  const { teamId, comment } = await req.json();

  if (!teamId) return NextResponse.json({ error: "teamId is required" }, { status: 400 });
  if (teamId !== game.homeTeamId && teamId !== game.awayTeamId)
    return NextResponse.json({ error: "Team is not part of this game" }, { status: 400 });

  const updated = await prisma.game.update({
    where: { id: gameId },
    data: {
      protestStatus: "FILED",
      protestTeamId: teamId,
      protestComment: (comment as string | undefined)?.trim() || null,
    },
  });

  return NextResponse.json({ ok: true, protestStatus: updated.protestStatus });
}

// PATCH /api/leagues/[slug]/games/[gameId]/protest — uphold or deny
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, gameId } = await params;
  const isMasterAdmin = (session.user as any).isMasterAdmin;
  const result = await resolveAdminGame(slug, gameId, session.user.id!, isMasterAdmin);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  const { resolution } = await req.json();
  if (resolution !== "UPHELD" && resolution !== "DENIED")
    return NextResponse.json({ error: "resolution must be UPHELD or DENIED" }, { status: 400 });

  const updated = await prisma.game.update({
    where: { id: gameId },
    data: { protestStatus: resolution },
  });

  return NextResponse.json({ ok: true, protestStatus: updated.protestStatus });
}

// DELETE /api/leagues/[slug]/games/[gameId]/protest — withdraw / clear a protest
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, gameId } = await params;
  const isMasterAdmin = (session.user as any).isMasterAdmin;
  const result = await resolveAdminGame(slug, gameId, session.user.id!, isMasterAdmin);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  await prisma.game.update({
    where: { id: gameId },
    data: { protestStatus: null, protestTeamId: null, protestComment: null },
  });

  return NextResponse.json({ ok: true });
}
