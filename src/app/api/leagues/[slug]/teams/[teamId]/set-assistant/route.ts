import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ slug: string; teamId: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const { slug, teamId } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id!;
  const isMasterAdmin = (session.user as any).isMasterAdmin;

  const league = await prisma.league.findUnique({
    where: { slug },
    include: { userRoles: { where: { userId } } },
  });
  if (!league) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isLeagueAdmin = isMasterAdmin || league.userRoles.some((r) => r.role === "LEAGUE_ADMIN");

  const team = await prisma.team.findFirst({ where: { id: teamId, leagueId: league.id } });
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const isTeamManager = team.managerId === userId &&
    league.userRoles.some((r) => r.role === "TEAM_MANAGER" || r.role === "TEAM_MANAGER_PLAYER");

  if (!isLeagueAdmin && !isTeamManager)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { playerId } = await req.json();
  if (!playerId) return NextResponse.json({ error: "playerId is required" }, { status: 400 });

  const player = await prisma.player.findFirst({
    where: { id: playerId, teamId, leagueId: league.id, isActive: true },
  });
  if (!player) return NextResponse.json({ error: "Player not found on this team" }, { status: 404 });
  if (!player.userId) return NextResponse.json({ error: "Player has no linked account" }, { status: 400 });
  if (player.userId === team.managerId) return NextResponse.json({ error: "Manager cannot also be the assistant" }, { status: 400 });
  if (player.userId === team.assistantId) return NextResponse.json({ error: "Player is already the assistant" }, { status: 400 });

  const oldAssistantId = team.assistantId;

  await prisma.$transaction(async (tx) => {
    // Remove old assistant role if they no longer assist any other team in this league
    if (oldAssistantId) {
      const stillAssists = await tx.team.findFirst({
        where: { leagueId: league.id, id: { not: teamId }, assistantId: oldAssistantId },
      });
      if (!stillAssists) {
        await tx.userLeagueRole.deleteMany({
          where: { userId: oldAssistantId, leagueId: league.id, role: { in: ["TEAM_ASSISTANT", "TEAM_ASSISTANT_PLAYER"] } },
        });
      }
    }

    // Assign TEAM_ASSISTANT_PLAYER role (player is already on the roster)
    await tx.userLeagueRole.upsert({
      where: { userId_leagueId_role: { userId: player.userId!, leagueId: league.id, role: "TEAM_ASSISTANT_PLAYER" } },
      update: {},
      create: { userId: player.userId!, leagueId: league.id, role: "TEAM_ASSISTANT_PLAYER" },
    });

    await tx.team.update({ where: { id: teamId }, data: { assistantId: player.userId } });
  });

  return NextResponse.json({ ok: true });
}
