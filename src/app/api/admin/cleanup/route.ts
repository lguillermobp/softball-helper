import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit, getRequestMeta } from "@/lib/audit";

export const dynamic = "force-dynamic";

// ── GET — fetch inactive records ──────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!(session?.user as any)?.isMasterAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [inactiveUsers, inactiveTeams] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: false, isMasterAdmin: false },
      select: {
        id: true, name: true, email: true, createdAt: true,
        emailVerified: true,
        leagueRoles: { select: { id: true, role: true, league: { select: { name: true } } } },
        players: { select: { id: true, name: true, team: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.team.findMany({
      where: { isActive: false },
      select: {
        id: true, name: true, status: true, createdAt: true,
        league: { select: { id: true, name: true } },
        players: { select: { id: true } },
        _count: {
          select: {
            players: true,
          },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  // For each inactive team, count games (home or away)
  const teamIds = inactiveTeams.map((t) => t.id);
  const gameCounts = await Promise.all(
    teamIds.map((id) =>
      prisma.game.count({ where: { OR: [{ homeTeamId: id }, { awayTeamId: id }] } })
    )
  );

  const teams = inactiveTeams.map((t, i) => ({
    id:          t.id,
    name:        t.name,
    status:      t.status,
    createdAt:   t.createdAt.toISOString(),
    leagueName:  t.league.name,
    playerCount: t._count.players,
    gameCount:   gameCounts[i],
    canDelete:   gameCounts[i] === 0,
  }));

  const users = inactiveUsers.map((u) => ({
    id:           u.id,
    name:         u.name,
    email:        u.email,
    createdAt:    u.createdAt.toISOString(),
    emailVerified: !!u.emailVerified,
    leagueCount:  u.leagueRoles.length,
    playerCount:  u.players.length,
    leagues:      [...new Set(u.leagueRoles.map((r) => r.league.name))],
    teams:        [...new Set(u.players.map((p) => p.team.name))],
  }));

  return NextResponse.json({ users, teams });
}

// ── DELETE — delete selected records ─────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!(session?.user as any)?.isMasterAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userIds = [], teamIds = [] }: { userIds: string[]; teamIds: string[] } = await req.json();

  const deleted = { users: 0, teams: 0, errors: [] as string[] };

  // Delete inactive teams (only those without games)
  for (const teamId of teamIds) {
    const gameCount = await prisma.game.count({
      where: { OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
    });
    if (gameCount > 0) {
      deleted.errors.push(`Team ${teamId} has ${gameCount} game(s) and cannot be deleted`);
      continue;
    }
    // Delete game lineups for players on this team first
    const playerIds = await prisma.player.findMany({
      where: { teamId },
      select: { id: true },
    }).then((ps) => ps.map((p) => p.id));
    if (playerIds.length > 0) {
      await prisma.gameLineup.deleteMany({ where: { playerId: { in: playerIds } } });
    }
    await prisma.team.delete({ where: { id: teamId } });
    deleted.teams++;
  }

  // Delete inactive users (set userId=null on player records, then delete user)
  for (const userId of userIds) {
    // Detach from player records instead of cascading delete (preserve historical data)
    await prisma.player.updateMany({ where: { userId }, data: { userId: null } });
    await prisma.user.delete({ where: { id: userId } });
    deleted.users++;
  }

  await logAudit({
    actor: session!.user as any,
    action: "admin.cleanup",
    metadata: { deletedUsers: deleted.users, deletedTeams: deleted.teams, errors: deleted.errors },
    ...getRequestMeta(req),
  });

  return NextResponse.json(deleted);
}
