import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { AddSeasonDialog } from "@/components/league/AddSeasonDialog";
import { AddCategoryDialog } from "@/components/league/AddCategoryDialog";
import { AddTeamDialog } from "@/components/league/AddTeamDialog";
import { AddMemberDialog } from "@/components/league/AddMemberDialog";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function LeaguePage({ params }: PageProps) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const league = await prisma.league.findUnique({
    where: { slug },
    include: {
      plan: true,
      userRoles: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      seasons: { orderBy: { startDate: "desc" } },
      categories: true,
      teams: {
        include: { season: true, category: true },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!league) notFound();

  const sessionUser = session.user!;
  const isMasterAdmin = (sessionUser as any).isMasterAdmin;
  const userRole = league.userRoles.find((r) => r.userId === sessionUser.id);
  if (!isMasterAdmin && !userRole) redirect("/dashboard");

  const role = userRole?.role ?? "MASTER_ADMIN";
  const isAdmin = isMasterAdmin || role === "LEAGUE_ADMIN";

  function roleLabel(r: string) { return r.replace(/_/g, " "); }

  function seasonBadge(status: string) {
    if (status === "ACTIVE")    return { bg: "#14532d", color: "#4ade80", text: "Active" };
    if (status === "COMPLETED") return { bg: "#1f2937", color: "#9ca3af", text: "Completed" };
    return { bg: "#78350f", color: "#fbbf24", text: "Upcoming" };
  }

  const cardStyle = {
    borderColor: "#1e3a1e",
    background: "#0f2310",
  };

  const sectionHeadStyle = { color: "#f0fdf4" };
  const mutedStyle = { color: "#4ade80" };
  const dimStyle = { color: "#6b7280" };

  return (
    <div className="min-h-screen" style={{ background: "#0a1a0a" }}>
      {/* ── Header ── */}
      <header
        className="border-b sticky top-0 z-10"
        style={{ borderColor: "#1e3a1e", background: "#0f2310" }}
      >
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-sm flex items-center gap-1 transition-colors hover:opacity-80"
              style={{ color: "#4ade80" }}
            >
              ← Dashboard
            </Link>
            <span style={{ color: "#2d5a2d" }}>|</span>
            <span className="font-bold" style={{ color: "#f0fdf4" }}>
              {league.name}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span
              className="text-xs font-medium border rounded-full px-2.5 py-0.5"
              style={{
                background: "#1a3d1a",
                color: "#4ade80",
                borderColor: "#2d5a2d",
              }}
            >
              {roleLabel(role)}
            </span>
            <span className="hidden sm:block text-sm" style={{ color: "#86efac" }}>
              {sessionUser.name}
            </span>
            <form action="/api/auth/signout" method="POST">
              <button
                type="submit"
                className="text-sm px-3 py-1.5 rounded-md border transition-colors"
                style={{ borderColor: "#2d5a2d", color: "#86efac", background: "transparent" }}
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 space-y-8">
        {/* ── Stat row ── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {/* League info */}
          <div
            className="col-span-2 rounded-2xl border p-5"
            style={cardStyle}
          >
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={dimStyle}>
              League Info
            </p>
            {(league.city || league.state) && (
              <p className="text-sm mb-1" style={mutedStyle}>
                📍 {[league.city, league.state].filter(Boolean).join(", ")}
              </p>
            )}
            <p className="text-sm mb-1" style={mutedStyle}>
              📋 Plan: <span className="font-semibold" style={{ color: "#f0fdf4" }}>{league.plan.name}</span>
            </p>
            <p className="text-sm" style={mutedStyle}>
              🔖 Status:{" "}
              <span
                className="font-semibold capitalize"
                style={{
                  color: league.status === "ACTIVE" ? "#4ade80" :
                         league.status === "SUSPENDED" ? "#f87171" : "#9ca3af",
                }}
              >
                {league.status.toLowerCase()}
              </span>
            </p>
          </div>

          {/* Seasons stat */}
          <div className="rounded-2xl border p-5 flex flex-col justify-between" style={cardStyle}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={dimStyle}>Seasons</p>
            <p className="text-4xl font-bold" style={{ color: "#4ade80" }}>{league.seasons.length}</p>
            <p className="text-xs mt-1" style={dimStyle}>total</p>
          </div>

          {/* Teams stat */}
          <div className="rounded-2xl border p-5 flex flex-col justify-between" style={cardStyle}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={dimStyle}>Teams</p>
            <p className="text-4xl font-bold" style={{ color: "#4ade80" }}>{league.teams.length}</p>
            <p className="text-xs mt-1" style={dimStyle}>registered</p>
          </div>
        </div>

        {/* ── Seasons ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold" style={sectionHeadStyle}>Seasons</h2>
            {isAdmin && <AddSeasonDialog slug={slug} />}
          </div>
          {league.seasons.length === 0 ? (
            <div
              className="rounded-2xl border py-10 text-center text-sm"
              style={{ ...cardStyle, color: "#4ade80" }}
            >
              No seasons yet. {isAdmin && "Click «+ Add season» to create one."}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {league.seasons.map((season) => {
                const badge = seasonBadge(season.status);
                return (
                  <div
                    key={season.id}
                    className="rounded-xl border p-4 flex items-center justify-between"
                    style={cardStyle}
                  >
                    <div>
                      <p className="font-semibold" style={{ color: "#f0fdf4" }}>{season.name}</p>
                      <p className="text-xs mt-0.5" style={dimStyle}>
                        {new Date(season.startDate).toLocaleDateString()} –{" "}
                        {new Date(season.endDate).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className="text-xs font-semibold rounded-full px-3 py-1"
                      style={{ background: badge.bg, color: badge.color }}
                    >
                      {badge.text}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Categories ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold" style={sectionHeadStyle}>Categories</h2>
            {isAdmin && <AddCategoryDialog slug={slug} />}
          </div>
          {league.categories.length === 0 ? (
            <div
              className="rounded-2xl border py-10 text-center text-sm"
              style={{ ...cardStyle, color: "#4ade80" }}
            >
              No categories yet. {isAdmin && "Click «+ Add category» to create one."}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {league.categories.map((cat) => (
                <span
                  key={cat.id}
                  className="rounded-full border px-4 py-1.5 text-sm font-medium"
                  style={{
                    borderColor: "#2d5a2d",
                    background: "#1a3d1a",
                    color: "#86efac",
                  }}
                >
                  {cat.name}
                  {cat.description && (
                    <span style={{ color: "#4ade80", fontWeight: 400 }}>
                      {" "}— {cat.description}
                    </span>
                  )}
                </span>
              ))}
            </div>
          )}
        </section>

        {/* ── Teams ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold" style={sectionHeadStyle}>Teams</h2>
            {isAdmin && (
              <AddTeamDialog
                slug={slug}
                seasons={league.seasons.map((s) => ({ id: s.id, name: s.name }))}
                categories={league.categories.map((c) => ({ id: c.id, name: c.name }))}
              />
            )}
          </div>
          {league.teams.length === 0 ? (
            <div
              className="rounded-2xl border py-10 text-center text-sm"
              style={{ ...cardStyle, color: "#4ade80" }}
            >
              No teams yet. {isAdmin && "Click «+ Add team» to add one."}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {league.teams.map((team) => (
                <div
                  key={team.id}
                  className="rounded-xl border p-4"
                  style={cardStyle}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm mb-2"
                    style={{ background: "#1a3d1a", color: "#4ade80" }}
                  >
                    {team.name.charAt(0).toUpperCase()}
                  </div>
                  <p className="font-semibold" style={{ color: "#f0fdf4" }}>{team.name}</p>
                  <div className="flex gap-2 mt-1.5 flex-wrap">
                    {team.season && (
                      <span
                        className="text-xs rounded px-1.5 py-0.5"
                        style={{ background: "#1a3d1a", color: "#4ade80" }}
                      >
                        {team.season.name}
                      </span>
                    )}
                    {team.category && (
                      <span
                        className="text-xs rounded px-1.5 py-0.5"
                        style={{ background: "#1e3a5f", color: "#93c5fd" }}
                      >
                        {team.category.name}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Members ── */}
        {isAdmin && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold" style={sectionHeadStyle}>Members</h2>
              <AddMemberDialog slug={slug} />
            </div>
            <div className="rounded-2xl border overflow-hidden" style={cardStyle}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid #1e3a1e" }}>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={dimStyle}>Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={dimStyle}>Email</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={dimStyle}>Role</th>
                  </tr>
                </thead>
                <tbody>
                  {league.userRoles.map((ur) => (
                    <tr
                      key={ur.id}
                      style={{ borderBottom: "1px solid #0f2310" }}
                    >
                      <td className="px-4 py-3 font-medium" style={{ color: "#f0fdf4" }}>
                        {ur.user.name ?? "—"}
                      </td>
                      <td className="px-4 py-3" style={dimStyle}>
                        {ur.user.email}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="text-xs font-semibold rounded-full px-2.5 py-0.5"
                          style={{ background: "#1a3d1a", color: "#4ade80" }}
                        >
                          {roleLabel(ur.role)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
