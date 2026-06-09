import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { computeSeasonStats, computeGameStats, type BatterRow } from "@/lib/stats";
import Link from "next/link";
import { LeagueDashboard } from "@/components/league/LeagueDashboard";
import { PlayerDashboard } from "@/components/league/PlayerDashboard";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageSelector } from "@/components/ui/language-selector";
import { SignOutButton } from "@/components/ui/sign-out-button";
import { ChangePasswordButton } from "@/components/ui/change-password-button";

interface PageProps {
  params: Promise<{ slug: string }>;
}

const ROLE_PRIORITY = ["LEAGUE_ADMIN", "UMPIRE", "SCOREKEEPER", "TEAM_MANAGER", "TEAM_MANAGER_PLAYER", "TEAM_ASSISTANT", "TEAM_ASSISTANT_PLAYER", "PLAYER"];

export default async function LeaguePage({ params }: PageProps) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const sessionUser = session.user!;
  const isMasterAdmin = (sessionUser as any).isMasterAdmin;

  // ── Common league query (used for all roles) ──────────────────────────────
  const league = await prisma.league.findUnique({
    where: { slug },
    include: {
      plan: true,
      userRoles: {
        include: { user: { select: { id: true, name: true, email: true, phone: true, emailVerified: true } } },
      },
      seasons: { orderBy: { startDate: "desc" } },
    },
  });
  if (!league) notFound();

  // Pick the highest-priority role for the current user
  const myRoles = league.userRoles.filter((r) => r.userId === sessionUser.id);
  const userRole = myRoles.sort((a, b) => ROLE_PRIORITY.indexOf(a.role) - ROLE_PRIORITY.indexOf(b.role))[0];
  if (!isMasterAdmin && !userRole) redirect("/dashboard");

  const role = userRole?.role ?? "MASTER_ADMIN";

  const seasons = league.seasons.map((s) => ({
    id: s.id,
    name: s.name,
    startDate: s.startDate.toISOString(),
    endDate: s.endDate.toISOString(),
    status: s.status,
  }));

  // ── Header (shared across all roles) ──────────────────────────────────────
  const Header = (
    <header className="border-b sticky top-0 z-10"
      style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-header)" }}>
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-sm flex items-center gap-1 transition-colors hover:opacity-80"
            style={{ color: "var(--sh-primary)" }}>
            ← Dashboard
          </Link>
          <span style={{ color: "var(--sh-border2)" }}>|</span>
          <div className="flex items-center gap-2">
            {league.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={league.logoUrl} alt={league.name}
                className="w-7 h-7 rounded-md object-cover shrink-0"
                style={{ border: "1px solid var(--sh-border2)" }} />
            )}
            <span className="font-bold" style={{ color: "var(--sh-text)" }}>{league.name}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: "var(--sh-bg-card2)", color: "var(--sh-primary)", border: "1px solid var(--sh-border2)" }}>
              {sessionUser.name?.charAt(0).toUpperCase() ?? "?"}
            </div>
            <span className="text-sm" style={{ color: "var(--sh-secondary)" }}>{sessionUser.name}</span>
          </div>
          {role.replace(/_/g, " ").toLowerCase() !== (sessionUser.name ?? "").toLowerCase() && (
            <span className="text-xs font-medium border rounded-full px-2.5 py-0.5"
              style={{ background: "var(--sh-bg-card2)", color: "var(--sh-primary)", borderColor: "var(--sh-border2)" }}>
              {role.replace(/_/g, " ")}
            </span>
          )}
          <ThemeToggle />
          <LanguageSelector />
          <ChangePasswordButton />
          <SignOutButton />
        </div>
      </div>
    </header>
  );

  // ── PLAYER view ────────────────────────────────────────────────────────────
  if (role === "PLAYER") {
    const myPlayers = await prisma.player.findMany({
      where: { leagueId: league.id, userId: sessionUser.id },
      include: {
        team: {
          include: {
            manager:   { select: { name: true, email: true, phone: true } },
            assistant: { select: { name: true, email: true, phone: true } },
            players:   { orderBy: { name: "asc" }, select: { id: true, name: true, jerseyNumber: true, nationality: true, photoUrl: true } },
          },
        },
      },
    });

    // Load game stats for all of the player's lineup entries
    const myPlayerIds = myPlayers.map((p) => p.id);
    const gameLineups = myPlayerIds.length > 0
      ? await prisma.gameLineup.findMany({
          where: { playerId: { in: myPlayerIds } },
          include: {
            game: {
              select: {
                id: true, scheduledAt: true, status: true,
                homeScore: true, awayScore: true,
                homeTeam: { select: { id: true, name: true, logoUrl: true } },
                awayTeam: { select: { id: true, name: true, logoUrl: true } },
                season:   { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { game: { scheduledAt: "desc" } },
        })
      : [];

    // Compute stats per player
    const statsMap: Record<string, {
      gamesPlayed: number; wins: number; losses: number; ties: number;
      positions: Record<string, number>;
      recentGames: {
        gameId: string; seasonId: string; seasonName: string; date: string;
        opponentName: string; position: string; battingOrder: number | null;
        teamScore: number | null; opponentScore: number | null;
        status: string; result: "W" | "L" | "T" | null;
      }[];
    }> = {};

    for (const entry of gameLineups) {
      const { game } = entry;
      if (!statsMap[entry.playerId]) {
        statsMap[entry.playerId] = { gamesPlayed: 0, wins: 0, losses: 0, ties: 0, positions: {}, recentGames: [] };
      }
      const s = statsMap[entry.playerId];
      const isHome = entry.isHome;
      const teamScore = isHome ? game.homeScore : game.awayScore;
      const oppScore  = isHome ? game.awayScore : game.homeScore;
      const opponent  = isHome ? game.awayTeam.name : game.homeTeam.name;

      let result: "W" | "L" | "T" | null = null;
      if (game.status === "COMPLETED" && teamScore !== null && oppScore !== null) {
        result = teamScore > oppScore ? "W" : teamScore < oppScore ? "L" : "T";
        s.gamesPlayed++;
        if (result === "W") s.wins++;
        else if (result === "L") s.losses++;
        else s.ties++;
      } else if (game.status === "IN_PROGRESS") {
        s.gamesPlayed++;
      }

      s.positions[entry.position] = (s.positions[entry.position] ?? 0) + 1;
      s.recentGames.push({
        gameId: game.id,
        seasonId: game.season.id,
        seasonName: game.season.name,
        date: game.scheduledAt.toISOString(),
        opponentName: opponent,
        position: entry.position,
        battingOrder: entry.battingOrder,
        teamScore, opponentScore: oppScore,
        status: game.status,
        result,
      });
    }

    // ── Full schedule + scorebook data ────────────────────────────────────────
    const allTeamIds = myPlayers.map(p => p.team.id);

    const [teamGames, teamScorebooks] = await Promise.all([
      allTeamIds.length > 0 ? prisma.game.findMany({
        where: { OR: [{ homeTeamId: { in: allTeamIds } }, { awayTeamId: { in: allTeamIds } }] },
        select: {
          id: true, scheduledAt: true, status: true,
          homeScore: true, awayScore: true, homeTeamId: true, awayTeamId: true,
          homeTeam: { select: { name: true } },
          awayTeam: { select: { name: true } },
          season:   { select: { id: true, name: true } },
        },
        orderBy: { scheduledAt: "asc" },
      }) : Promise.resolve([]),
      allTeamIds.length > 0 ? prisma.managerScorebook.findMany({
        where: { teamId: { in: allTeamIds } },
        select: {
          gameId: true, teamId: true, data: true,
          game: {
            select: {
              scheduledAt: true, homeTeamId: true,
              homeTeam: { select: { name: true } },
              awayTeam: { select: { name: true } },
            }
          },
        },
      }) : Promise.resolve([]),
    ]);

    const sbGameIds = teamScorebooks.map(s => s.gameId);
    const playerLineupsBySb = sbGameIds.length > 0 && myPlayerIds.length > 0
      ? await prisma.gameLineup.findMany({
          where: { playerId: { in: myPlayerIds }, gameId: { in: sbGameIds }, battingOrder: { not: null } },
          select: { gameId: true, battingOrder: true, playerId: true },
        })
      : [];

    const myTeams = myPlayers.map(({ id: playerId, team }) => {
      // ── Official schedule ────────────────────────────────────────────────────
      const schedule = teamGames
        .filter(g => g.homeTeamId === team.id || g.awayTeamId === team.id)
        .map(g => {
          const isMyTeamHome = g.homeTeamId === team.id;
          const myScore  = isMyTeamHome ? g.homeScore : g.awayScore;
          const oppScore = isMyTeamHome ? g.awayScore : g.homeScore;
          let result: "W" | "L" | "T" | null = null;
          if (g.status === "COMPLETED" && myScore !== null && oppScore !== null) {
            result = myScore > oppScore ? "W" : myScore < oppScore ? "L" : "T";
          }
          return {
            gameId: g.id, seasonId: g.season.id, seasonName: g.season.name,
            date: g.scheduledAt.toISOString(),
            homeTeamName: g.homeTeam.name, awayTeamName: g.awayTeam.name,
            isMyTeamHome, homeScore: g.homeScore, awayScore: g.awayScore,
            status: g.status, result,
          };
        });

      // ── Unofficial batting stats from manager's scorebook ────────────────────
      const teamSbs = teamScorebooks.filter(s => s.teamId === team.id);
      const sbEntries = teamSbs
        .map(sb => {
          const lineupEntry = playerLineupsBySb.find(l => l.playerId === playerId && l.gameId === sb.gameId);
          const data = sb.data as { offense?: Record<string, Record<string, string>> } | null;
          const isMyTeamHome = sb.game.homeTeamId === team.id;
          return {
            gameId: sb.gameId,
            date: sb.game.scheduledAt.toISOString(),
            opponentName: isMyTeamHome ? sb.game.awayTeam.name : sb.game.homeTeam.name,
            batter: lineupEntry
              ? { playerId, battingOrder: lineupEntry.battingOrder!, name: "", jerseyNumber: null, photoUrl: null, nationality: null } as BatterRow
              : null,
            offense: data?.offense ?? null,
          };
        })
        .filter(e => e.batter !== null);

      const seasonTotalsArr = computeSeasonStats(
        sbEntries.map(e => ({ lineup: [e.batter as BatterRow], offense: e.offense }))
      );
      const st = seasonTotalsArr[0];

      const perGame = sbEntries
        .map(e => {
          const [s] = computeGameStats(e.offense, [e.batter as BatterRow]);
          return s && s.ab > 0 ? {
            gameId: e.gameId, date: e.date, opponentName: e.opponentName,
            ab: s.ab, h: s.h, singles: s.singles, doubles: s.doubles, triples: s.triples, hr: s.hr, ba: s.ba,
          } : null;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      return {
        id: team.id, name: team.name, logoUrl: team.logoUrl ?? null,
        manager: team.manager, assistant: team.assistant, teammates: team.players,
        stats: statsMap[playerId] ?? { gamesPlayed: 0, wins: 0, losses: 0, ties: 0, positions: {}, recentGames: [] },
        schedule,
        unofficialStats: sbEntries.length > 0 ? {
          seasonTotals: st ? { ab: st.ab, h: st.h, singles: st.singles, doubles: st.doubles, triples: st.triples, hr: st.hr, ba: st.ba } : null,
          perGame,
        } : null,
      };
    });

    return (
      <div className="min-h-screen" style={{ background: "var(--sh-bg-page)" }}>
        {Header}
        <main className="mx-auto max-w-6xl px-4 py-8" style={{ color: "var(--sh-text)" }}>
          <PlayerDashboard
            slug={slug}
            league={{ name: league.name, city: league.city, state: league.state }}
            myTeams={myTeams}
            seasons={seasons}
          />
        </main>
      </div>
    );
  }

  // ── Admin / Manager view ───────────────────────────────────────────────────
  const fullLeague = await prisma.league.findUnique({
    where: { slug },
    include: {
      publicPage: true,
      categories: true,
      teams: {
        include: {
          publicPage: true,
          season:    { select: { id: true, name: true, requireDob: true } },
          category:  { select: { id: true, name: true } },
          manager:   { select: { id: true, name: true, email: true, phone: true } },
          assistant: { select: { id: true, name: true, email: true, phone: true } },
          players: {
            where: { isActive: true },
            orderBy: { name: "asc" },
            include: { user: { select: { password: true, emailVerified: true } } },
          },
        },
        orderBy: { name: "asc" },
      },
      fields: { orderBy: { name: "asc" } },
    },
  });
  if (!fullLeague) notFound();

  const isAdmin = isMasterAdmin || role === "LEAGUE_ADMIN";

  // Load technician info for master admin
  const [technicianData, availableTechnicians] = isMasterAdmin
    ? await Promise.all([
        prisma.league.findUnique({
          where: { slug },
          select: { technician: { select: { id: true, name: true, email: true } } },
        }).then(l => l?.technician ?? null),
        prisma.user.findMany({
          where: { OR: [{ isSupportTechnician: true }, { isMasterAdmin: true }], isActive: true },
          select: { id: true, name: true, email: true },
          orderBy: { name: "asc" },
        }),
      ])
    : [null, []];

  const categories = fullLeague.categories.map((c) => ({ id: c.id, name: c.name, description: c.description }));

  const teams = fullLeague.teams.map((t) => ({
    id: t.id, name: t.name, logoUrl: t.logoUrl ?? null, status: t.status, isActive: t.isActive,
    seasonId: t.seasonId, categoryId: t.categoryId,
    season: t.season, category: t.category,
    requireDob: t.season?.requireDob ?? false,
    manager:   t.manager   ? { id: t.manager.id,   name: t.manager.name,   email: t.manager.email,   phone: t.manager.phone }   : null,
    assistant: t.assistant ? { id: t.assistant.id, name: t.assistant.name, email: t.assistant.email, phone: t.assistant.phone } : null,
    players: t.players.map((p) => ({
      id: p.id, name: p.name, email: p.email, jerseyNumber: p.jerseyNumber, nationality: p.nationality ?? null, photoUrl: p.photoUrl ?? null, dob: p.dob ? p.dob.toISOString() : null, userId: p.userId,
      invitePending: !!(p.email && (!p.user?.password || !p.user?.emailVerified)),
    })),
    publicPage: t.publicPage ? {
      published: t.publicPage.published,
      description: t.publicPage.description,
      showRoster: t.publicPage.showRoster,
      showStats: t.publicPage.showStats,
      showSchedule: t.publicPage.showSchedule,
      socialLinks: t.publicPage.socialLinks as Record<string, string> | null,
    } : null,
  }));

  const members = league.userRoles.map((ur) => ({
    id: ur.id, role: ur.role,
    user: {
      id: ur.user.id, name: ur.user.name, email: ur.user.email,
      phone: ur.user.phone, emailVerified: ur.user.emailVerified?.toISOString() ?? null,
    },
  }));

  const fields = fullLeague.fields.map((f) => ({
    id: f.id, name: f.name, types: f.types as string[],
    slotStartTime: f.slotStartTime ?? null,
    slotDurationMins: f.slotDurationMins,
    slotsMonday: f.slotsMonday, slotsTuesday: f.slotsTuesday, slotsWednesday: f.slotsWednesday,
    slotsThursday: f.slotsThursday, slotsFriday: f.slotsFriday, slotsSaturday: f.slotsSaturday, slotsSunday: f.slotsSunday,
    defaultScorekeeperUserId: f.defaultScorekeeperUserId ?? null,
    defaultUmpireUserId: f.defaultUmpireUserId ?? null,
  }));

  const officials = league.userRoles
    .filter(ur => ur.role === "SCOREKEEPER" || ur.role === "UMPIRE")
    .map(ur => ({ id: ur.user.id, name: ur.user.name ?? ur.user.email, role: ur.role }))
    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));

  const rawConditions = await prisma.condition.findMany({
    where: { leagueId: league.id },
    include: { createdBy: { select: { id: true, name: true, email: true } } },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  const conditions = rawConditions.map((c) => ({
    id: c.id, title: c.title, content: c.content,
    fileUrl: c.fileUrl, fileName: c.fileName, fileType: c.fileType,
    order: c.order, createdAt: c.createdAt.toISOString(), createdBy: c.createdBy,
  }));

  return (
    <div className="min-h-screen" style={{ background: "var(--sh-bg-page)" }}>
      {Header}
      <main className="mx-auto max-w-6xl px-4 py-8" style={{ color: "var(--sh-text)" }}>
        <LeagueDashboard
          slug={slug}
          isAdmin={isAdmin}
          isMasterAdmin={isMasterAdmin}
          currentUserId={sessionUser.id!}
          technician={technicianData}
          availableTechnicians={availableTechnicians}
          league={{ id: league.id, name: league.name, city: league.city, state: league.state, status: league.status, logoUrl: fullLeague.logoUrl ?? null, bannerUrl: fullLeague.bannerUrl ?? null, plan: { name: league.plan.name } }}
          seasons={seasons}
          categories={categories}
          teams={teams}
          members={members}
          fields={fields}
          officials={officials}
          conditions={conditions}
          publicPage={fullLeague.publicPage ? {
            published: fullLeague.publicPage.published,
            description: fullLeague.publicPage.description,
            showStandings: fullLeague.publicPage.showStandings,
            showSchedule: fullLeague.publicPage.showSchedule,
            showTeams: fullLeague.publicPage.showTeams,
            socialLinks: fullLeague.publicPage.socialLinks as Record<string, string> | null,
          } : null}
        />
      </main>
    </div>
  );
}
