import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ slug: string; gameId: string }> }

const gameInclude = {
  homeTeam: { select: { id: true, name: true } },
  awayTeam: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
  field:    { select: { id: true, name: true } },
} as const;

async function getAdminLeague(slug: string, userId: string, isMasterAdmin: boolean) {
  const league = await prisma.league.findUnique({
    where: { slug },
    include: { userRoles: { where: { userId } } },
  });
  if (!league) return null;
  const isAdmin = isMasterAdmin || league.userRoles.some((r) => r.role === "LEAGUE_ADMIN");
  return isAdmin ? league : null;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, gameId } = await params;
  const league = await getAdminLeague(slug, session.user.id!, (session.user as any).isMasterAdmin);
  if (!league) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const game = await prisma.game.findFirst({ where: { id: gameId, leagueId: league.id } });
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });
  if (game.status !== "SCHEDULED")
    return NextResponse.json({ error: "Only scheduled games can be edited" }, { status: 409 });

  const { homeTeamId, awayTeamId, fieldId, scheduledAt, homeAwayTbd, categoryId } =
    await req.json();

  if (!homeTeamId || !awayTeamId || !scheduledAt)
    return NextResponse.json({ error: "homeTeamId, awayTeamId and scheduledAt are required" }, { status: 400 });

  if (homeTeamId === awayTeamId)
    return NextResponse.json({ error: "Home and away teams must be different" }, { status: 400 });

  const updated = await prisma.game.update({
    where: { id: gameId },
    data: {
      homeTeamId,
      awayTeamId,
      fieldId:     fieldId || null,
      scheduledAt: new Date(scheduledAt),
      homeAwayTbd: homeAwayTbd === true,
      categoryId:  categoryId || null,
    },
    include: gameInclude,
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, gameId } = await params;
  const league = await getAdminLeague(slug, session.user.id!, (session.user as any).isMasterAdmin);
  if (!league) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const game = await prisma.game.findFirst({ where: { id: gameId, leagueId: league.id } });
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });
  if (game.status !== "SCHEDULED")
    return NextResponse.json({ error: "Only scheduled games can be deleted" }, { status: 409 });

  await prisma.game.delete({ where: { id: gameId } });
  return NextResponse.json({ success: true });
}
