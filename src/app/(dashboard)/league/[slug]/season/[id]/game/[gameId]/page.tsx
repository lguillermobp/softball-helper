import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageSelector } from "@/components/ui/language-selector";
import { SignOutButton } from "@/components/ui/sign-out-button";
import { ChangePasswordButton } from "@/components/ui/change-password-button";
import { GameScoringView } from "@/components/league/game/GameScoringView";

interface PageProps {
  params: Promise<{ slug: string; id: string; gameId: string }>;
}

export default async function GameScoringPage({ params }: PageProps) {
  const { slug, id: seasonId, gameId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const sessionUser = session.user!;
  const isMasterAdmin = (sessionUser as any).isMasterAdmin as boolean;
  const userId = sessionUser.id!;

  // Load league with user roles
  const league = await prisma.league.findUnique({
    where: { slug },
    include: {
      userRoles: { where: { userId } },
      fields: { orderBy: { name: "asc" } },
    },
  });
  if (!league) notFound();

  const userRole = league.userRoles[0];
  if (!isMasterAdmin && !userRole) redirect("/dashboard");

  const isAdmin    = isMasterAdmin || userRole?.role === "LEAGUE_ADMIN";
  const isUmpire   = userRole?.role === "UMPIRE";
  const isScorer   = userRole?.role === "SCOREKEEPER";

  // Load game
  const game = await prisma.game.findFirst({
    where: { id: gameId, leagueId: league.id, seasonId },
    include: {
      homeTeam: {
        select: {
          id: true, name: true, logoUrl: true, managerId: true, assistantId: true,
          players: { orderBy: { name: "asc" } },
        },
      },
      awayTeam: {
        select: {
          id: true, name: true, logoUrl: true, managerId: true, assistantId: true,
          players: { orderBy: { name: "asc" } },
        },
      },
      field:    { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
      officials: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      lineups: {
        include: { player: { select: { id: true, name: true, jerseyNumber: true, nationality: true, photoUrl: true } } },
      },
    },
  });
  if (!game) notFound();

  const season = await prisma.season.findFirst({ where: { id: seasonId, leagueId: league.id } });
  if (!season) notFound();

  // Load umpires and scorers from league members
  const eligibleOfficials = await prisma.userLeagueRole.findMany({
    where: {
      leagueId: league.id,
      role: { in: ["UMPIRE", "SCOREKEEPER"] },
    },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { user: { name: "asc" } },
  });

  const isHomeManager = game.homeTeam.managerId === userId || game.homeTeam.assistantId === userId;
  const isAwayManager = game.awayTeam.managerId === userId || game.awayTeam.assistantId === userId;
  const canEditOfficials = isAdmin || isUmpire;
  const canStartGame     = isAdmin || isUmpire;
  const canSwapTeams     = isAdmin || isUmpire || isScorer;
  const canEditHomeLineup =
    (game.status === "SCHEDULED" && (isAdmin || isUmpire || isHomeManager)) ||
    (game.status === "IN_PROGRESS" && (isAdmin || isScorer));
  const canEditAwayLineup =
    (game.status === "SCHEDULED" && (isAdmin || isUmpire || isAwayManager)) ||
    (game.status === "IN_PROGRESS" && (isAdmin || isScorer));
  const canEditHomeScorebook = isAdmin || isHomeManager;
  const canEditAwayScorebook = isAdmin || isAwayManager;

  // Load scorebooks
  const [homeScorebook, awayScorebook] = await Promise.all([
    prisma.managerScorebook.findUnique({
      where: { gameId_teamId: { gameId: game.id, teamId: game.homeTeamId } },
    }),
    prisma.managerScorebook.findUnique({
      where: { gameId_teamId: { gameId: game.id, teamId: game.awayTeamId } },
    }),
  ]);

  // Serialize for client
  const serializedGame = {
    id: game.id,
    status: game.status,
    scheduledAt: game.scheduledAt.toISOString(),
    homeAwayTbd: game.homeAwayTbd,
    homeScore: game.homeScore,
    awayScore: game.awayScore,
    fieldId: game.fieldId,
    field: game.field,
    category: game.category,
    homeTeam: {
      id: game.homeTeam.id,
      name: game.homeTeam.name,
      logoUrl: game.homeTeam.logoUrl ?? null,
      players: game.homeTeam.players.map(p => ({
        id: p.id, name: p.name, jerseyNumber: p.jerseyNumber, nationality: p.nationality ?? null, photoUrl: p.photoUrl ?? null,
      })),
    },
    awayTeam: {
      id: game.awayTeam.id,
      name: game.awayTeam.name,
      logoUrl: game.awayTeam.logoUrl ?? null,
      players: game.awayTeam.players.map(p => ({
        id: p.id, name: p.name, jerseyNumber: p.jerseyNumber, nationality: p.nationality ?? null, photoUrl: p.photoUrl ?? null,
      })),
    },
    officials: game.officials.map(o => ({
      id: o.id, role: o.role,
      user: { id: o.user.id, name: o.user.name, email: o.user.email },
    })),
    lineups: game.lineups.map(l => ({
      id: l.id, isHome: l.isHome, position: l.position, battingOrder: l.battingOrder,
      player: l.player,
    })),
  };

  const fields = league.fields.map(f => ({ id: f.id, name: f.name }));
  const umpireOptions = eligibleOfficials.filter(o => o.role === "UMPIRE").map(o => ({
    id: o.user.id, name: o.user.name ?? o.user.email, email: o.user.email,
  }));
  const scorerOptions = eligibleOfficials.filter(o => o.role === "SCOREKEEPER").map(o => ({
    id: o.user.id, name: o.user.name ?? o.user.email, email: o.user.email,
  }));

  return (
    <div className="min-h-screen" style={{ background: "var(--sh-bg-page)" }}>
      <header className="border-b sticky top-0 z-10" style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-header)" }}>
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Link href={`/league/${slug}/season/${seasonId}`} className="text-sm hover:opacity-80 shrink-0" style={{ color: "var(--sh-primary)" }}>
              ← {season.name}
            </Link>
            <span style={{ color: "var(--sh-border2)" }}>|</span>
            <span className="font-semibold truncate" style={{ color: "var(--sh-text)" }}>
              {game.homeTeam.name} <span style={{ color: "var(--sh-muted)" }}>vs</span> {game.awayTeam.name}
            </span>
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
              <span
                className="text-xs font-medium border rounded-full px-2.5 py-0.5"
                style={{ background: "var(--sh-bg-card2)", color: "var(--sh-primary)", borderColor: "var(--sh-border2)" }}
              >
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

      <main className="mx-auto max-w-6xl px-4 py-8" style={{ color: "var(--sh-text)" }}>
        <GameScoringView
          slug={slug}
          seasonId={seasonId}
          game={serializedGame}
          fields={fields}
          umpireOptions={umpireOptions}
          scorerOptions={scorerOptions}
          permissions={{
            canEditOfficials,
            canStartGame,
            canEditHomeLineup,
            canEditAwayLineup,
            canSwapTeams,
            canEditHomeScorebook,
            canEditAwayScorebook,
          }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          homeScorebook={(homeScorebook?.data ?? null) as any}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          awayScorebook={(awayScorebook?.data ?? null) as any}
        />
      </main>
    </div>
  );
}
