import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DashboardView } from "@/components/dashboard/DashboardView";
import type { ScheduleGame, StatRow } from "@/components/dashboard/DashboardSchedule";

const ROLE_PRIORITY = ["LEAGUE_ADMIN", "UMPIRE", "SCOREKEEPER", "TEAM_MANAGER", "TEAM_MANAGER_PLAYER", "TEAM_ASSISTANT", "TEAM_ASSISTANT_PLAYER", "PLAYER"];
const PLAYING_ROLES = new Set(["PLAYER", "TEAM_MANAGER_PLAYER", "TEAM_ASSISTANT_PLAYER"]);
const SCHEDULE_SKIP_ROLES = new Set(["LEAGUE_ADMIN"]);

const GAME_INCLUDE = {
  homeTeam: { select: { id: true, name: true, logoUrl: true } },
  awayTeam: { select: { id: true, name: true, logoUrl: true } },
  league:   { select: { id: true, name: true, slug: true } },
  season:   { select: { id: true, name: true } },
  category: { select: { name: true } },
  field:    { select: { name: true } },
} as const;

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const isMasterAdmin       = (session.user as any).isMasterAdmin as boolean;
  const isSupportTechnician = (session.user as any).isSupportTechnician as boolean;
  const userId              = session.user.id!;

  if (isMasterAdmin) {
    const allLeagues = await prisma.league.findMany({
      include: {
        plan: { select: { name: true } },
        _count: { select: { seasons: true, teams: true, players: true } },
      },
      orderBy: { name: "asc" },
    });

    return (
      <DashboardView
        isMasterAdmin
        isSupportTechnician={isSupportTechnician}
        userName={session.user.name}
        allLeagues={allLeagues.map(l => ({
          id: l.id, name: l.name, slug: l.slug,
          city: l.city, state: l.state, status: l.status,
          plan: { name: l.plan.name }, _count: l._count,
        }))}
        leagueRoles={[]}
      />
    );
  }

  // ── Regular user ─────────────────────────────────────────────────────────────
  const userWithLeagues = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      leagueRoles: {
        include: {
          league: { include: { _count: { select: { seasons: true, teams: true } } } },
        },
      },
    },
  });

  const allRoles = (userWithLeagues?.leagueRoles ?? []).map(r => r.role);

  const leagueMap = new Map<string, { role: string; league: { id: string; name: string; slug: string; city: string | null; state: string | null; _count: { seasons: number; teams: number } } }>();
  for (const ur of (userWithLeagues?.leagueRoles ?? [])) {
    const entry = { role: ur.role, league: { id: ur.league.id, name: ur.league.name, slug: ur.league.slug, city: ur.league.city, state: ur.league.state, _count: ur.league._count } };
    const existing = leagueMap.get(ur.league.id);
    if (!existing || ROLE_PRIORITY.indexOf(ur.role) < ROLE_PRIORITY.indexOf(existing.role)) leagueMap.set(ur.league.id, entry);
  }

  // ── Schedule + stats (skip for pure league-admin users) ──────────────────────
  const hasScheduleRoles = allRoles.some(r => !SCHEDULE_SKIP_ROLES.has(r));
  const hasPlayingRole   = allRoles.some(r => PLAYING_ROLES.has(r));

  let scheduleGames: ScheduleGame[] = [];
  let stats:         StatRow[]       = [];

  if (hasScheduleRoles) {
    const pastCutoff = new Date();
    pastCutoff.setDate(pastCutoff.getDate() - 90);

    // Parallel lookups for role context
    const [officialAssignments, myManagedTeams, myPlayerRecords] = await Promise.all([
      prisma.gameOfficial.findMany({
        where: { userId },
        select: { gameId: true, role: true },
      }),
      prisma.team.findMany({
        where: { OR: [{ managerId: userId }, { assistantId: userId }], isActive: true },
        select: { id: true, name: true, managerId: true },
      }),
      prisma.player.findMany({
        where: { userId, isActive: true },
        select: { id: true, teamId: true, jerseyNumber: true, team: { select: { name: true } } },
      }),
    ]);

    const officialGameIds  = new Set(officialAssignments.map(o => o.gameId));
    const officialRoleMap  = new Map(officialAssignments.map(o => [o.gameId, o.role as string]));
    const managedTeamIds   = new Set(myManagedTeams.map(t => t.id));
    const assistedTeamIds  = new Set(myManagedTeams.filter(t => t.managerId !== userId).map(t => t.id));
    const managedTeamName  = new Map(myManagedTeams.map(t => [t.id, t.name]));
    const playerTeamIds    = new Set(myPlayerRecords.map(p => p.teamId));
    const playerTeamName   = new Map(myPlayerRecords.map(p => [p.teamId, p.team.name]));

    const teamIds = [...managedTeamIds, ...playerTeamIds];

    const rawGames = teamIds.length > 0 || officialGameIds.size > 0
      ? await prisma.game.findMany({
          where: {
            scheduledAt: { gte: pastCutoff },
            status: { not: "RESCHEDULED" },
            OR: [
              ...(officialGameIds.size > 0 ? [{ id: { in: [...officialGameIds] } }] : []),
              ...(teamIds.length > 0      ? [{ homeTeamId: { in: teamIds } }, { awayTeamId: { in: teamIds } }] : []),
            ],
          },
          include: GAME_INCLUDE,
          orderBy: { scheduledAt: "asc" },
        })
      : [];

    const now = new Date();

    // Build ScheduleGame list — priority: manager > assistant > player > official
    const gameEntries = new Map<string, ScheduleGame>();
    for (const g of rawGames) {
      const myTeamId = managedTeamIds.has(g.homeTeamId) || managedTeamIds.has(g.awayTeamId)
        ? ([...managedTeamIds].find(id => id === g.homeTeamId || id === g.awayTeamId) ?? null)
        : playerTeamIds.has(g.homeTeamId) || playerTeamIds.has(g.awayTeamId)
        ? ([...playerTeamIds].find(id => id === g.homeTeamId || id === g.awayTeamId) ?? null)
        : null;

      let roleLabel: string;
      let myTeamIsHome: boolean | null = null;

      if (myTeamId && managedTeamIds.has(myTeamId)) {
        const isAssistant = assistedTeamIds.has(myTeamId);
        roleLabel  = `${isAssistant ? "Assistant" : "Manager"} · ${managedTeamName.get(myTeamId)}`;
        myTeamIsHome = g.homeTeamId === myTeamId;
      } else if (myTeamId && playerTeamIds.has(myTeamId)) {
        roleLabel  = `Player · ${playerTeamName.get(myTeamId)}`;
        myTeamIsHome = g.homeTeamId === myTeamId;
      } else if (officialGameIds.has(g.id)) {
        const r = officialRoleMap.get(g.id) ?? "UMPIRE";
        roleLabel = r === "SCOREKEEPER" ? "Scorekeeper" : "Umpire";
      } else {
        continue;
      }

      gameEntries.set(g.id, {
        id: g.id,
        scheduledAt: g.scheduledAt.toISOString(),
        status: g.status,
        isPractice: g.isPractice,
        homeScore: g.homeScore,
        awayScore: g.awayScore,
        homeTeam: g.homeTeam,
        awayTeam: g.awayTeam,
        league:   { id: g.league.id, name: g.league.name, slug: g.league.slug },
        season:   g.season,
        category: g.category?.name ?? null,
        field:    g.field?.name ?? null,
        roleLabel,
        myTeamIsHome,
      });
    }

    const allGames = [...gameEntries.values()];
    const upcoming = allGames.filter(g => new Date(g.scheduledAt) >= now || g.status === "IN_PROGRESS")
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
    const past = allGames.filter(g => new Date(g.scheduledAt) < now && g.status !== "IN_PROGRESS" && g.status !== "SCHEDULED")
      .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
      .slice(0, 5);

    scheduleGames = [...upcoming, ...past.reverse()].sort(
      (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    );

    // ── Stats (playing roles only) ──────────────────────────────────────────────
    if (hasPlayingRole && myPlayerRecords.length > 0) {
      const playerIds = myPlayerRecords.map(p => p.id);
      const atBats = await prisma.gameAtBat.findMany({
        where: { batterId: { in: playerIds } },
        select: {
          outcome: true,
          game: { select: { leagueId: true, seasonId: true, league: { select: { name: true, slug: true } }, season: { select: { name: true } } } },
        },
      });

      // Accumulate per league+season
      type Acc = { leagueName: string; leagueSlug: string; seasonName: string; ab: number; h: number; singles: number; doubles: number; triples: number; hr: number; bb: number };
      const acc = new Map<string, Acc>();
      for (const ab of atBats) {
        const key = `${ab.game.leagueId}::${ab.game.seasonId}`;
        if (!acc.has(key)) acc.set(key, { leagueName: ab.game.league.name, leagueSlug: ab.game.league.slug, seasonName: ab.game.season.name, ab: 0, h: 0, singles: 0, doubles: 0, triples: 0, hr: 0, bb: 0 });
        const s = acc.get(key)!;
        const o = String(ab.outcome);
        if (o === "BB") { s.bb++; continue; }
        if (["OUT", "K", "FC", "E"].includes(o)) { s.ab++; continue; }
        s.ab++;
        if (o === "1B") { s.h++; s.singles++; }
        else if (o === "2B") { s.h++; s.doubles++; }
        else if (o === "3B") { s.h++; s.triples++; }
        else if (o === "HR") { s.h++; s.hr++; }
      }

      stats = [...acc.values()].map(s => ({
        leagueName: s.leagueName, leagueSlug: s.leagueSlug, seasonName: s.seasonName,
        gp: 0, // not easily computable here without joins; omit or derive from schedule
        ab: s.ab, h: s.h, singles: s.singles, doubles: s.doubles, triples: s.triples, hr: s.hr,
        ba: s.ab === 0 ? "—" : (s.h / s.ab).toFixed(3).replace(/^0/, ""),
      }));
    }
  }

  return (
    <DashboardView
      isMasterAdmin={false}
      isSupportTechnician={isSupportTechnician}
      userName={session.user.name}
      allLeagues={[]}
      leagueRoles={Array.from(leagueMap.values())}
      scheduleGames={scheduleGames}
      stats={stats}
      hasPlayingRole={hasPlayingRole}
    />
  );
}
