import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ slug: string; seasonId: string }> }

// Set which league teams participate in this season (and their division).
export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, seasonId } = await params;

  const league = await prisma.league.findUnique({
    where: { slug },
    select: { id: true, status: true, userRoles: { where: { userId: me.id, role: "LEAGUE_ADMIN" }, select: { id: true } } },
  });
  if (!league) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!me.isMasterAdmin && league.userRoles.length === 0)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (league.status === "SUSPENDED") return NextResponse.json({ error: "This league is currently suspended." }, { status: 423 });

  const season = await prisma.season.findFirst({ where: { id: seasonId, leagueId: league.id }, select: { id: true } });
  if (!season) return NextResponse.json({ error: "Season not found" }, { status: 404 });

  const body = await req.json();
  const rawTeams: Array<{ teamId?: string; categoryId?: string | null }> = Array.isArray(body.teams) ? body.teams : [];

  // Only accept teams and categories that belong to this league
  const [leagueTeams, leagueCats] = await Promise.all([
    prisma.team.findMany({ where: { leagueId: league.id }, select: { id: true } }),
    prisma.category.findMany({ where: { leagueId: league.id }, select: { id: true } }),
  ]);
  const teamIds = new Set(leagueTeams.map((t) => t.id));
  const catIds = new Set(leagueCats.map((c) => c.id));

  const keep = new Map<string, string | null>();
  for (const t of rawTeams) {
    if (!t?.teamId || !teamIds.has(t.teamId)) continue;
    keep.set(t.teamId, t.categoryId && catIds.has(t.categoryId) ? t.categoryId : null);
  }

  await prisma.$transaction(async (tx) => {
    // Drop teams that no longer participate this season
    await tx.teamSeason.deleteMany({ where: { seasonId, teamId: { notIn: [...keep.keys()] } } });
    // Add/update the participating teams with their division
    for (const [teamId, categoryId] of keep) {
      await tx.teamSeason.upsert({
        where: { teamId_seasonId: { teamId, seasonId } },
        update: { categoryId },
        create: { teamId, seasonId, categoryId },
      });
    }
  });

  return NextResponse.json({ ok: true, count: keep.size });
}
