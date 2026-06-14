import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ slug: string; userId: string }> }

const HITS = new Set(["SINGLE", "DOUBLE", "TRIPLE", "HOME_RUN"]);

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, userId } = await params;

  // Caller must be master admin or a league admin of this league
  const league = await prisma.league.findUnique({
    where: { slug },
    select: {
      id: true, name: true,
      userRoles: { where: { userId: me.id, role: "LEAGUE_ADMIN" }, select: { id: true } },
    },
  });
  if (!league) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!me.isMasterAdmin && !me.isSupportTechnician && league.userRoles.length === 0)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const leagueId = league.id;

  // Basic user info
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, phone: true, isActive: true, createdAt: true },
  });
  if (!u) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [leagueRoles, managedTeams, assistedTeams, players, officialGroups] = await Promise.all([
    prisma.userLeagueRole.findMany({
      where: { userId, leagueId },
      select: { role: true },
    }),
    prisma.team.findMany({
      where: { leagueId, managerId: userId },
      select: { id: true, name: true },
    }),
    prisma.team.findMany({
      where: { leagueId, assistantId: userId },
      select: { id: true, name: true },
    }),
    prisma.player.findMany({
      where: { leagueId, userId },
      select: { id: true, team: { select: { name: true } } },
    }),
    prisma.gameOfficial.groupBy({
      by: ["role"],
      where: { userId, game: { leagueId } },
      _count: { id: true },
    }),
  ]);

  // Batting stats scoped to this league
  let ab = 0, h = 0, doubles = 0, triples = 0, hr = 0, bb = 0, k = 0;
  if (players.length > 0) {
    const atBatGroups = await prisma.gameAtBat.groupBy({
      by: ["outcome"],
      where: { batterId: { in: players.map(p => p.id) } },
      _count: { id: true },
    });
    for (const g of atBatGroups) {
      const cnt = g._count.id;
      if (g.outcome !== "WALK") ab += cnt;
      if (HITS.has(g.outcome)) h += cnt;
      if (g.outcome === "DOUBLE")    doubles += cnt;
      if (g.outcome === "TRIPLE")    triples += cnt;
      if (g.outcome === "HOME_RUN")  hr      += cnt;
      if (g.outcome === "WALK")      bb      += cnt;
      if (g.outcome === "STRIKEOUT") k       += cnt;
    }
  }

  return NextResponse.json({
    id: u.id, name: u.name, email: u.email, phone: u.phone,
    isMasterAdmin: false, isSupportTechnician: false,
    isActive: u.isActive, createdAt: u.createdAt.toISOString(),
    leagueRoles: leagueRoles.map(r => ({
      leagueName: league.name, leagueSlug: slug, role: r.role,
    })),
    managedTeams:  managedTeams.map(t => ({ id: t.id, name: t.name, leagueName: league.name, leagueSlug: slug })),
    assistedTeams: assistedTeams.map(t => ({ id: t.id, name: t.name, leagueName: league.name, leagueSlug: slug })),
    playerProfiles: players.map(p => ({ id: p.id, teamName: p.team.name, leagueName: league.name, leagueSlug: slug })),
    officialStats: officialGroups.map(g => ({ role: g.role, count: g._count.id })),
    battingStats: ab > 0 ? {
      ab, h, doubles, triples, hr, bb, k,
      ba: (h / ab).toFixed(3).replace(/^0/, ""),
    } : null,
    technicianLeagues: [],
  });
}
