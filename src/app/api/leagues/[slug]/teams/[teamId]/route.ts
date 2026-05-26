import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ slug: string; teamId: string }> }

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

  const { slug, teamId } = await params;
  const league = await getAdminLeague(slug, session.user.id!, (session.user as any).isMasterAdmin);
  if (!league) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const team = await prisma.team.findFirst({ where: { id: teamId, leagueId: league.id } });
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const body = await req.json();

  // isActive-only toggle (deactivate / reactivate)
  if ("isActive" in body && Object.keys(body).length === 1) {
    const updated = await prisma.team.update({
      where: { id: teamId },
      data: { isActive: body.isActive },
    });
    return NextResponse.json(updated);
  }

  const { name, seasonId, categoryId } = body;
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const updated = await prisma.team.update({
    where: { id: teamId },
    data: { name, seasonId: seasonId || null, categoryId: categoryId || null },
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, teamId } = await params;
  const league = await getAdminLeague(slug, session.user.id!, (session.user as any).isMasterAdmin);
  if (!league) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const team = await prisma.team.findFirst({ where: { id: teamId, leagueId: league.id } });
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const gameCount = await prisma.game.count({
    where: { OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
  });
  if (gameCount > 0)
    return NextResponse.json(
      { error: `Cannot delete: this team has ${gameCount} game(s) in the schedule.` },
      { status: 409 }
    );

  await prisma.team.delete({ where: { id: teamId } });
  return NextResponse.json({ success: true });
}
