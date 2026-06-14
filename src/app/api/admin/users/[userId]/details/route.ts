import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ userId: string }> }

const HITS = new Set(["SINGLE", "DOUBLE", "TRIPLE", "HOME_RUN"]);

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.isMasterAdmin && !me?.isSupportTechnician)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId } = await params;

  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, name: true, email: true, phone: true,
      isMasterAdmin: true, isSupportTechnician: true, isActive: true, createdAt: true,
      leagueRoles: {
        select: { role: true, league: { select: { id: true, name: true, slug: true } } },
        orderBy: { createdAt: "asc" },
      },
      managedTeams: {
        select: { id: true, name: true, league: { select: { id: true, name: true, slug: true } } },
      },
      assistedTeams: {
        select: { id: true, name: true, league: { select: { id: true, name: true, slug: true } } },
      },
      players: {
        select: {
          id: true,
          team:   { select: { name: true } },
          league: { select: { id: true, name: true, slug: true } },
        },
      },
      technicianLeagues: { select: { id: true, name: true, slug: true } },
    },
  });

  if (!u) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [officialGroups, atBatGroups] = await Promise.all([
    prisma.gameOfficial.groupBy({
      by: ["role"],
      where: { userId },
      _count: { id: true },
    }),
    u.players.length > 0
      ? prisma.gameAtBat.groupBy({
          by: ["outcome"],
          where: { batterId: { in: u.players.map(p => p.id) } },
          _count: { id: true },
        })
      : Promise.resolve([]),
  ]);

  // Aggregate batting stats
  let ab = 0, h = 0, doubles = 0, triples = 0, hr = 0, bb = 0, k = 0;
  for (const g of atBatGroups) {
    const cnt = g._count.id;
    if (g.outcome !== "WALK") ab += cnt;
    if (HITS.has(g.outcome)) h += cnt;
    if (g.outcome === "DOUBLE")   doubles += cnt;
    if (g.outcome === "TRIPLE")   triples += cnt;
    if (g.outcome === "HOME_RUN") hr      += cnt;
    if (g.outcome === "WALK")     bb      += cnt;
    if (g.outcome === "STRIKEOUT") k      += cnt;
  }

  return NextResponse.json({
    id: u.id, name: u.name, email: u.email, phone: u.phone,
    isMasterAdmin: u.isMasterAdmin, isSupportTechnician: u.isSupportTechnician,
    isActive: u.isActive, createdAt: u.createdAt.toISOString(),
    leagueRoles: u.leagueRoles.map(lr => ({
      leagueName: lr.league.name, leagueSlug: lr.league.slug, role: lr.role,
    })),
    managedTeams: u.managedTeams.map(t => ({
      id: t.id, name: t.name, leagueName: t.league.name, leagueSlug: t.league.slug,
    })),
    assistedTeams: u.assistedTeams.map(t => ({
      id: t.id, name: t.name, leagueName: t.league.name, leagueSlug: t.league.slug,
    })),
    playerProfiles: u.players.map(p => ({
      id: p.id, teamName: p.team.name, leagueName: p.league.name, leagueSlug: p.league.slug,
    })),
    officialStats: officialGroups.map(g => ({ role: g.role, count: g._count.id })),
    battingStats: ab > 0 ? {
      ab, h, doubles, triples, hr, bb, k,
      ba: (h / ab).toFixed(3).replace(/^0/, ""),
    } : null,
    technicianLeagues: u.technicianLeagues,
  });
}
