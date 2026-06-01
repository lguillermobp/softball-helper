import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageSelector } from "@/components/ui/language-selector";
import { SignOutButton } from "@/components/ui/sign-out-button";
import { ChangePasswordButton } from "@/components/ui/change-password-button";
import { PlayerStatsTable } from "@/components/league/game/PlayerStatsTable";
import { computeSeasonStats, computeGameStats, type BatterRow } from "@/lib/stats";

interface PageProps {
  params: Promise<{ slug: string; id: string; teamId: string }>;
}

export default async function TeamStatsPage({ params }: PageProps) {
  const { slug, id: seasonId, teamId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const sessionUser = session.user!;
  const isMasterAdmin = (sessionUser as any).isMasterAdmin as boolean;
  const userId = sessionUser.id!;

  const league = await prisma.league.findUnique({
    where: { slug },
    include: { userRoles: { where: { userId } } },
  });
  if (!league) notFound();

  const userRole = league.userRoles[0];
  if (!isMasterAdmin && !userRole) redirect("/dashboard");

  const [season, team] = await Promise.all([
    prisma.season.findFirst({ where: { id: seasonId, leagueId: league.id } }),
    prisma.team.findFirst({
      where: { id: teamId, leagueId: league.id },
      select: { id: true, name: true },
    }),
  ]);
  if (!season) notFound();
  if (!team) notFound();

  // Load all scorebooks for this team in this season
  const scorebooks = await prisma.managerScorebook.findMany({
    where: { teamId, game: { seasonId, leagueId: league.id } },
    select: { gameId: true, data: true, game: { select: { id: true, scheduledAt: true, homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } } } } },
    orderBy: { game: { scheduledAt: "asc" } },
  });

  const gameIds = scorebooks.map(s => s.gameId);

  // Load lineups for players of this team across those games
  const lineupEntries = await prisma.gameLineup.findMany({
    where: {
      gameId: { in: gameIds },
      player: { teamId },
      battingOrder: { not: null },
    },
    select: {
      gameId: true,
      battingOrder: true,
      player: { select: { id: true, name: true, jerseyNumber: true } },
    },
  });

  // Group lineups by gameId
  const lineupsByGame = new Map<string, BatterRow[]>();
  for (const entry of lineupEntries) {
    const rows = lineupsByGame.get(entry.gameId) ?? [];
    rows.push({
      playerId: entry.player.id,
      battingOrder: entry.battingOrder!,
      name: entry.player.name,
      jerseyNumber: entry.player.jerseyNumber ?? null,
    });
    lineupsByGame.set(entry.gameId, rows);
  }

  // Build game entries for aggregation
  const gameEntries = scorebooks.map(sb => {
    const data = sb.data as { offense?: Record<string, Record<string, string>> } | null;
    return {
      lineup: lineupsByGame.get(sb.gameId) ?? [],
      offense: data?.offense ?? null,
    };
  });

  const seasonStats = computeSeasonStats(gameEntries);

  // Per-game stats for the game-by-game breakdown
  const perGameStats = scorebooks.map(sb => {
    const data = sb.data as { offense?: Record<string, Record<string, string>> } | null;
    const lineup = lineupsByGame.get(sb.gameId) ?? [];
    const opponent = sb.game.homeTeam.name === team.name ? sb.game.awayTeam.name : sb.game.homeTeam.name;
    const date = sb.game.scheduledAt.toLocaleDateString();
    return { gameId: sb.gameId, label: `${date} vs ${opponent}`, lineup, offense: data?.offense ?? null };
  });

  return (
    <div className="min-h-screen" style={{ background: "var(--sh-bg-page)" }}>
      <header className="border-b sticky top-0 z-10" style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-header)" }}>
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0 flex-wrap">
            <Link href={`/league/${slug}/season/${seasonId}`} className="text-sm hover:opacity-80 shrink-0" style={{ color: "var(--sh-primary)" }}>
              ← {season.name}
            </Link>
            <span style={{ color: "var(--sh-border2)" }}>|</span>
            <span className="font-semibold truncate" style={{ color: "var(--sh-text)" }}>{team.name} — Stats</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{ background: "var(--sh-bg-card2)", color: "var(--sh-primary)", border: "1px solid var(--sh-border2)" }}>
                {sessionUser.name?.charAt(0).toUpperCase() ?? "?"}
              </div>
              <span className="text-sm" style={{ color: "var(--sh-secondary)" }}>{sessionUser.name}</span>
            </div>
            {(userRole?.role ?? "MASTER_ADMIN").replace(/_/g, " ").toLowerCase() !== (sessionUser.name ?? "").toLowerCase() && (
              <span className="text-xs font-medium border rounded-full px-2.5 py-0.5"
                style={{ background: "var(--sh-bg-card2)", color: "var(--sh-primary)", borderColor: "var(--sh-border2)" }}>
                {(userRole?.role ?? "MASTER_ADMIN").replace(/_/g, " ")}
              </span>
            )}
            <ThemeToggle />
            <LanguageSelector />
            <ChangePasswordButton />
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 space-y-8" style={{ color: "var(--sh-text)" }}>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold" style={{ color: "var(--sh-text)" }}>{season.name} — Season Stats</h2>
            <span className="text-xs font-semibold rounded-full px-2.5 py-0.5" style={{ background: "var(--sh-bg-card2)", color: "var(--sh-warn)", border: "1px solid var(--sh-border2)" }}>
              Unofficial
            </span>
          </div>
          <p className="text-sm mt-1" style={{ color: "var(--sh-muted)" }}>
            These are the manager&apos;s own records, kept independently from the official league statistics.
            Aggregated from {scorebooks.length} scored game{scorebooks.length !== 1 ? "s" : ""}.
          </p>
        </div>

        {/* Season totals */}
        <PlayerStatsTable stats={seasonStats} teamName={team.name} label="Season Totals" />

        {/* Per-game breakdown */}
        {perGameStats.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-widest" style={{ color: "var(--sh-primary)" }}>
              Game by Game
            </h3>
            {perGameStats.map(g => (
              <PlayerStatsTable key={g.gameId} stats={computeGameStats(g.offense, g.lineup)} teamName={team.name} label={g.label} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
