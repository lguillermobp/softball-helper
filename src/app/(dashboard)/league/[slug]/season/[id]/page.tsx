import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { SeasonDashboard } from "@/components/league/SeasonDashboard";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageSelector } from "@/components/ui/language-selector";
import { SignOutButton } from "@/components/ui/sign-out-button";
import { ChangePasswordButton } from "@/components/ui/change-password-button";

interface PageProps {
  params: Promise<{ slug: string; id: string }>;
}

export default async function SeasonPage({ params }: PageProps) {
  const { slug, id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const league = await prisma.league.findUnique({
    where: { slug },
    include: {
      userRoles: { where: { userId: session.user.id } },
      categories: true,
      teams: { where: { seasonId: id }, orderBy: { name: "asc" } },
      fields: { orderBy: { name: "asc" } },
    },
  });
  if (!league) notFound();

  const sessionUser = session.user!;
  const isMasterAdmin = (sessionUser as any).isMasterAdmin;
  const userRole = league.userRoles[0];
  if (!isMasterAdmin && !userRole) redirect("/dashboard");

  const isAdmin = isMasterAdmin || userRole?.role === "LEAGUE_ADMIN";

  const season = await prisma.season.findFirst({ where: { id, leagueId: league.id } });
  if (!season) notFound();

  const games = await prisma.game.findMany({
    where: { seasonId: id },
    include: {
      homeTeam:        { select: { id: true, name: true, logoUrl: true } },
      awayTeam:        { select: { id: true, name: true, logoUrl: true } },
      category:        { select: { id: true, name: true } },
      field:           { select: { id: true, name: true } },
      rescheduledFrom: { select: { id: true, scheduledAt: true } },
    },
    orderBy: { scheduledAt: "asc" },
  });

  // ── Compute standings from completed games ──────────────────────────────────
  type SlimTeam = { id: string; name: string; group: string | null };
  const zero = (team: SlimTeam) => ({ team, gp: 0, w: 0, l: 0, t: 0, pts: 0, rf: 0, ra: 0 });

  const statsMap = new Map<string, ReturnType<typeof zero>>(
    league.teams.map((t) => [t.id, zero({ id: t.id, name: t.name, group: t.group ?? null })])
  );

  for (const game of games) {
    if (game.status !== "COMPLETED") continue;
    const hs = game.homeScore ?? 0;
    const as_ = game.awayScore ?? 0;

    if (!statsMap.has(game.homeTeamId))
      statsMap.set(game.homeTeamId, zero({ ...game.homeTeam, group: null }));
    if (!statsMap.has(game.awayTeamId))
      statsMap.set(game.awayTeamId, zero({ ...game.awayTeam, group: null }));

    const home = statsMap.get(game.homeTeamId)!;
    const away = statsMap.get(game.awayTeamId)!;

    home.gp++; away.gp++;
    home.rf += hs; home.ra += as_;
    away.rf += as_; away.ra += hs;

    if (hs > as_) {
      home.w++; home.pts += 2;
      away.l++;
    } else if (as_ > hs) {
      away.w++; away.pts += 2;
      home.l++;
    } else {
      home.t++; home.pts += 1;
      away.t++; away.pts += 1;
    }
  }

  const standings = Array.from(statsMap.values())
    .sort((a, b) => b.pts - a.pts || b.rf - b.ra - (a.rf - a.ra))
    .map((s) => ({
      ...s,
      pct: s.gp === 0 ? ".000" : (s.w / s.gp).toFixed(3).replace(/^0/, ""),
    }));

  const serializedGames = games.map((g) => ({
    ...g,
    scheduledAt: g.scheduledAt.toISOString(),
    rescheduledFrom: g.rescheduledFrom
      ? { id: g.rescheduledFrom.id, scheduledAt: g.rescheduledFrom.scheduledAt.toISOString() }
      : null,
  }));

  const serializedFields = league.fields.map((f) => ({ id: f.id, name: f.name }));

  return (
    <div className="min-h-screen" style={{ background: "var(--sh-bg-page)" }}>
      {/* Header */}
      <header
        className="border-b sticky top-0 z-10"
        style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-header)" }}
      >
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-sm hover:opacity-80"
              style={{ color: "var(--sh-primary)" }}
            >
              ← Dashboard
            </Link>
            <span style={{ color: "var(--sh-border2)" }}>|</span>
            <Link
              href={`/league/${slug}`}
              className="text-sm hover:opacity-80"
              style={{ color: "var(--sh-primary)" }}
            >
              {league.name}
            </Link>
            <span style={{ color: "var(--sh-border2)" }}>|</span>
            <span className="font-bold" style={{ color: "var(--sh-text)" }}>{season.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{ background: "var(--sh-bg-card2)", color: "var(--sh-primary)", border: "1px solid var(--sh-border2)" }}>
                {sessionUser.name?.charAt(0).toUpperCase() ?? "?"}
              </div>
              <span className="text-sm" style={{ color: "var(--sh-secondary)" }}>{sessionUser.name}</span>
            </div>
            <span
              className="text-xs font-medium border rounded-full px-2.5 py-0.5"
              style={{ background: "var(--sh-bg-card2)", color: "var(--sh-primary)", borderColor: "var(--sh-border2)" }}
            >
              {(userRole?.role ?? "MASTER_ADMIN").replace(/_/g, " ")}
            </span>
            <ThemeToggle />
            <LanguageSelector />
            <ChangePasswordButton />
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 space-y-6" style={{ color: "var(--sh-text)" }}>
        <SeasonDashboard
          slug={slug}
          seasonId={id}
          seasonName={season.name}
          startDate={season.startDate.toISOString()}
          endDate={season.endDate.toISOString()}
          seasonStatus={season.status}
          isAdmin={isAdmin}
          games={serializedGames}
          teams={league.teams.map((t) => ({ id: t.id, name: t.name, group: t.group ?? null }))}
          categories={league.categories.map((c) => ({ id: c.id, name: c.name }))}
          fields={serializedFields}
          standings={standings}
        />
      </main>
    </div>
  );
}
