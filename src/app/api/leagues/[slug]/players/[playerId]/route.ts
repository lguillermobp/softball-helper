import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ slug: string; playerId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, playerId } = await params;
  const userId = session.user.id!;
  const isMasterAdmin = (session.user as any).isMasterAdmin;

  const league = await prisma.league.findUnique({
    where: { slug },
    include: { userRoles: { where: { userId } } },
  });
  if (!league) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isLeagueAdmin = isMasterAdmin || league.userRoles.some((r) => r.role === "LEAGUE_ADMIN");

  const player = await prisma.player.findFirst({
    where: { id: playerId, leagueId: league.id },
    include: { team: { select: { id: true, status: true, managerId: true, assistantId: true } } },
  });
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  if (!isLeagueAdmin) {
    const isStaff =
      player.team.managerId === userId || player.team.assistantId === userId;
    if (!isStaff || player.team.status !== "PENDING")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { name, jerseyNumber } = body;
  const email: string | null = (body.email as string | undefined)?.trim() || null;

  if (email && email !== player.email) {
    const conflict = await prisma.player.findUnique({
      where: { email_teamId: { email, teamId: player.teamId } },
    });
    if (conflict && conflict.id !== playerId)
      return NextResponse.json({ error: "A player with this email already exists in the team" }, { status: 409 });
  }

  const updated = await prisma.player.update({
    where: { id: playerId },
    data: {
      ...(name         !== undefined && { name }),
      ...(body.email   !== undefined && { email }),
      ...(jerseyNumber !== undefined && { jerseyNumber: jerseyNumber || null }),
    },
  });

  return NextResponse.json(updated);
}
