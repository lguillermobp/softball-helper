import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { AddGameDialog } from "@/components/league/AddGameDialog";
import { SeasonDashboard } from "@/components/league/SeasonDashboard";

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
      homeTeam: { select: { id: true, name: true } },
      awayTeam: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
      field:    { select: { id: true, name: true } },
    },
    orderBy: { scheduledAt: "asc" },
  });

  // ── Compute standings from completed games ──────────────────────────────────
  type SlimTeam = { id: string; name: string };
  const zero = (team: SlimTeam) => ({ team, gp: 0, w: 0, l: 0, t: 0, pts: 0, rf: 0, ra: 0 });

  const statsMap = new Map<string, ReturnType<typeof zero>>(
    league.teams.map((t) => [t.id, zero({ id: t.id, name: t.name })])
  );

  for (const game of games) {
    if (game.status !== "COMPLETED") continue;
    const hs = game.homeScore ?? 0;
    const as_ = game.awayScore ?? 0;

    if (!statsMap.has(game.homeTeamId))
      statsMap.set(game.homeTeamId, zero(game.homeTeam));
    if (!statsMap.has(game.awayTeamId))
      statsMap.set(game.awayTeamId, zero(game.awayTeam));

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

  function seasonBadge(status: string) {
    if (status === "ACTIVE")    return { color: "#4ade80", text: "Active" };
    if (status === "COMPLETED") return { color: "#9ca3af", text: "Completed" };
    return { color: "#fbbf24", text: "Upcoming" };
  }

  const sb = seasonBadge(season.status);

  // Serialize dates for client component
  const serializedGames = games.map((g) => ({
    ...g,
    scheduledAt: g.scheduledAt.toISOString(),
  }));

  const serializedFields = league.fields.map((f) => ({ id: f.id, name: f.name }));

  return (
    <div className="min-h-screen" style={{ background: "#0a1a0a" }}>
      {/* Header */}
      <header
        className="border-b sticky top-0 z-10"
        style={{ borderColor: "#1e3a1e", background: "#0f2310" }}
      >
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-3">
          <Link href="/dashboard" className="text-sm hover:opacity-80" style={{ color: "#4ade80" }}>
            ← Dashboard
          </Link>
          <span style={{ color: "#2d5a2d" }}>|</span>
          <Link href={`/league/${slug}`} className="text-sm hover:opacity-80" style={{ color: "#4ade80" }}>
            {league.name}
          </Link>
          <span style={{ color: "#2d5a2d" }}>|</span>
          <span className="font-bold" style={{ color: "#f0fdf4" }}>{season.name}</span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        {/* Season info row */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "#f0fdf4" }}>{season.name}</h1>
            <p className="text-sm mt-1" style={{ color: "#4ade80" }}>
              {new Date(season.startDate).toLocaleDateString()} – {new Date(season.endDate).toLocaleDateString()}
              {" · "}
              <span style={{ color: sb.color }}>{sb.text}</span>
            </p>
          </div>
          {isAdmin && (
            <AddGameDialog
              slug={slug}
              seasonId={id}
              teams={league.teams.map((t) => ({ id: t.id, name: t.name }))}
              categories={league.categories.map((c) => ({ id: c.id, name: c.name }))}
              fields={serializedFields}
            />
          )}
        </div>

        {/* Tabbed dashboard */}
        <SeasonDashboard
          slug={slug}
          seasonId={id}
          isAdmin={isAdmin}
          games={serializedGames}
          teams={league.teams.map((t) => ({ id: t.id, name: t.name }))}
          categories={league.categories.map((c) => ({ id: c.id, name: c.name }))}
          fields={serializedFields}
          standings={standings}
        />
      </main>
    </div>
  );
}
