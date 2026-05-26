import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { AddGameDialog } from "@/components/league/AddGameDialog";

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
      teams: { orderBy: { name: "asc" } },
    },
  });
  if (!league) notFound();

  const sessionUser = session.user!;
  const isMasterAdmin = (sessionUser as any).isMasterAdmin;
  const userRole = league.userRoles[0];
  if (!isMasterAdmin && !userRole) redirect("/dashboard");

  const isAdmin = isMasterAdmin || userRole?.role === "LEAGUE_ADMIN";

  const season = await prisma.season.findFirst({
    where: { id, leagueId: league.id },
  });
  if (!season) notFound();

  const games = await prisma.game.findMany({
    where: { seasonId: id },
    include: {
      homeTeam: { select: { id: true, name: true } },
      awayTeam: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
    },
    orderBy: { scheduledAt: "asc" },
  });

  function statusBadge(status: string) {
    if (status === "COMPLETED")  return { bg: "#14532d", color: "#4ade80", text: "Final" };
    if (status === "IN_PROGRESS") return { bg: "#78350f", color: "#fbbf24", text: "Live" };
    if (status === "CANCELLED")  return { bg: "#3f1515", color: "#f87171", text: "Cancelled" };
    return { bg: "#1e3a5f", color: "#93c5fd", text: "Scheduled" };
  }

  function seasonBadge(status: string) {
    if (status === "ACTIVE")    return { color: "#4ade80", text: "Active" };
    if (status === "COMPLETED") return { color: "#9ca3af", text: "Completed" };
    return { color: "#fbbf24", text: "Upcoming" };
  }

  const sb = seasonBadge(season.status);
  const cardStyle = { borderColor: "#1e3a1e", background: "#0f2310" };

  return (
    <div className="min-h-screen" style={{ background: "#0a1a0a" }}>
      {/* Header */}
      <header
        className="border-b sticky top-0 z-10"
        style={{ borderColor: "#1e3a1e", background: "#0f2310" }}
      >
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-sm transition-colors hover:opacity-80"
            style={{ color: "#4ade80" }}
          >
            ← Dashboard
          </Link>
          <span style={{ color: "#2d5a2d" }}>|</span>
          <Link
            href={`/league/${slug}`}
            className="text-sm transition-colors hover:opacity-80"
            style={{ color: "#4ade80" }}
          >
            {league.name}
          </Link>
          <span style={{ color: "#2d5a2d" }}>|</span>
          <span className="font-bold" style={{ color: "#f0fdf4" }}>{season.name}</span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        {/* Season info */}
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
            />
          )}
        </div>

        {/* Schedule */}
        {games.length === 0 ? (
          <div
            className="rounded-2xl border py-16 text-center text-sm"
            style={{ ...cardStyle, color: "#4ade80" }}
          >
            No games scheduled yet.{isAdmin && " Click «+ Add game» to schedule the first one."}
          </div>
        ) : (
          <div className="space-y-3">
            {games.map((game) => {
              const badge = statusBadge(game.status);
              const date = new Date(game.scheduledAt);
              return (
                <div
                  key={game.id}
                  className="rounded-xl border p-4"
                  style={cardStyle}
                >
                  <div className="flex items-center justify-between gap-4">
                    {/* Teams */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="text-right flex-1">
                        <p className="font-bold truncate" style={{ color: "#f0fdf4" }}>
                          {game.homeTeam.name}
                        </p>
                        <p className="text-xs" style={{ color: "#4ade80" }}>Home</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {game.status === "COMPLETED" ? (
                          <span className="text-xl font-bold" style={{ color: "#4ade80" }}>
                            {game.homeScore ?? 0} – {game.awayScore ?? 0}
                          </span>
                        ) : (
                          <span className="text-sm font-semibold" style={{ color: "#6b7280" }}>vs</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold truncate" style={{ color: "#f0fdf4" }}>
                          {game.awayTeam.name}
                        </p>
                        <p className="text-xs" style={{ color: "#4ade80" }}>Away</p>
                      </div>
                    </div>

                    {/* Meta */}
                    <div className="text-right shrink-0">
                      <span
                        className="text-xs font-semibold rounded-full px-2.5 py-0.5"
                        style={{ background: badge.bg, color: badge.color }}
                      >
                        {badge.text}
                      </span>
                      <p className="text-xs mt-1" style={{ color: "#6b7280" }}>
                        {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                      {game.location && (
                        <p className="text-xs" style={{ color: "#4ade80" }}>📍 {game.location}</p>
                      )}
                      {game.category && (
                        <p className="text-xs" style={{ color: "#93c5fd" }}>{game.category.name}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
