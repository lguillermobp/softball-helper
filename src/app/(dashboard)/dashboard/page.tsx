import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const isMasterAdmin = (session.user as any).isMasterAdmin as boolean;

  // ── Data fetching ─────────────────────────────────────────────────────────

  let allLeagues: {
    id: string; name: string; slug: string; city: string | null; state: string | null;
    status: string; plan: { name: string };
    _count: { seasons: number; teams: number; players: number };
  }[] = [];

  let leagueRoles: {
    role: string;
    league: {
      id: string; name: string; slug: string; city: string | null; state: string | null;
      _count: { seasons: number; teams: number };
    };
  }[] = [];

  if (isMasterAdmin) {
    allLeagues = await prisma.league.findMany({
      include: {
        plan: { select: { name: true } },
        _count: { select: { seasons: true, teams: true, players: true } },
      },
      orderBy: { name: "asc" },
    });
  } else {
    const userWithLeagues = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        leagueRoles: {
          include: {
            league: {
              include: { _count: { select: { seasons: true, teams: true } } },
            },
          },
        },
      },
    });
    leagueRoles = userWithLeagues?.leagueRoles ?? [];
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function roleLabel(r: string) { return r.replace(/_/g, " "); }

  function roleColor(r: string) {
    if (r === "LEAGUE_ADMIN")   return "bg-amber-400/20 text-amber-300 border-amber-400/30";
    if (r === "UMPIRE")         return "bg-blue-400/20 text-blue-300 border-blue-400/30";
    if (r === "SCORER")         return "bg-purple-400/20 text-purple-300 border-purple-400/30";
    if (r === "TEAM_MANAGER")   return "bg-cyan-400/20 text-cyan-300 border-cyan-400/30";
    return "bg-green-400/20 text-green-300 border-green-400/30";
  }

  function statusDot(s: string) {
    if (s === "ACTIVE")    return { color: "#4ade80", label: "Active" };
    if (s === "SUSPENDED") return { color: "#f87171", label: "Suspended" };
    return { color: "#9ca3af", label: "Archived" };
  }

  // ── Layout ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ background: "#0a1a0a" }}>
      {/* ── Header ── */}
      <header
        className="border-b sticky top-0 z-10"
        style={{ borderColor: "#1e3a1e", background: "#0f2310" }}
      >
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="13" fill="#1a3d1a" stroke="#4ade80" strokeWidth="1.5"/>
              <path d="M8 10 C10 8, 10 6, 12 5" stroke="#4ade80" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
              <path d="M8 14 C10 12, 10 10, 12 9" stroke="#4ade80" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
              <path d="M8 18 C10 16, 10 14, 12 13" stroke="#4ade80" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
              <path d="M20 10 C18 8, 18 6, 16 5" stroke="#4ade80" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
              <path d="M20 14 C18 12, 18 10, 16 9" stroke="#4ade80" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
              <path d="M20 18 C18 16, 18 14, 16 13" stroke="#4ade80" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
            </svg>
            <span className="text-lg font-bold tracking-tight" style={{ color: "#4ade80" }}>
              Softball Helper
            </span>
            {isMasterAdmin && (
              <span
                className="text-xs font-bold rounded-full px-2.5 py-0.5 border"
                style={{ background: "#1e1a3d", color: "#a78bfa", borderColor: "#4c3d8a" }}
              >
                ★ Master Admin
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: "#1a3d1a", color: "#4ade80", border: "1px solid #2d5a2d" }}
              >
                {session.user.name?.charAt(0).toUpperCase() ?? "?"}
              </div>
              <span className="text-sm" style={{ color: "#86efac" }}>{session.user.name}</span>
            </div>
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

      <main className="mx-auto max-w-6xl px-4 py-8">

        {/* ══════════════════════════════════════════════════════════════════
            MASTER ADMIN VIEW
        ══════════════════════════════════════════════════════════════════ */}
        {isMasterAdmin && (
          <>
            {/* Title row */}
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold" style={{ color: "#f0fdf4" }}>
                  System Overview
                </h1>
                <p className="text-sm mt-1" style={{ color: "#a78bfa" }}>
                  {allLeagues.length} league{allLeagues.length !== 1 ? "s" : ""} registered in the system
                </p>
              </div>
              <Link href="/register">
                <button
                  className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all"
                  style={{
                    background: "linear-gradient(135deg, #16a34a, #15803d)",
                    color: "#fff",
                    boxShadow: "0 0 16px rgba(74,222,128,0.25)",
                  }}
                >
                  <span className="text-base">+</span> New league
                </button>
              </Link>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
              {[
                { label: "Total leagues",  value: allLeagues.length },
                { label: "Active leagues", value: allLeagues.filter((l) => l.status === "ACTIVE").length },
                { label: "Total teams",    value: allLeagues.reduce((s, l) => s + l._count.teams, 0) },
                { label: "Total players",  value: allLeagues.reduce((s, l) => s + l._count.players, 0) },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl border p-4 text-center" style={{ borderColor: "#1e3a1e", background: "#0f2310" }}>
                  <p className="text-3xl font-bold" style={{ color: "#a78bfa" }}>{stat.value}</p>
                  <p className="text-xs mt-1" style={{ color: "#6b7280" }}>{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Leagues table */}
            {allLeagues.length === 0 ? (
              <div className="rounded-2xl border py-16 text-center text-sm" style={{ borderColor: "#1e3a1e", background: "#0f2310", color: "#4ade80" }}>
                No leagues in the system yet.
              </div>
            ) : (
              <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "#1e3a1e", background: "#0f2310" }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: "1px solid #1e3a1e" }}>
                      {["League", "Location", "Plan", "Seasons", "Teams", "Players", "Status", ""].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                          style={{ color: "#6b7280" }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allLeagues.map((league) => {
                      const dot = statusDot(league.status);
                      return (
                        <tr
                          key={league.id}
                          className="transition-colors hover:bg-[#0f2f10]"
                          style={{ borderBottom: "1px solid #0f2310" }}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
                                style={{ background: "#1a3d1a", color: "#4ade80" }}
                              >
                                {league.name.charAt(0).toUpperCase()}
                              </div>
                              <span className="font-semibold" style={{ color: "#f0fdf4" }}>{league.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3" style={{ color: "#6b7280" }}>
                            {[league.city, league.state].filter(Boolean).join(", ") || "—"}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs font-medium rounded-full px-2 py-0.5" style={{ background: "#1a3d1a", color: "#4ade80" }}>
                              {league.plan.name}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center font-semibold" style={{ color: "#86efac" }}>
                            {league._count.seasons}
                          </td>
                          <td className="px-4 py-3 text-center font-semibold" style={{ color: "#86efac" }}>
                            {league._count.teams}
                          </td>
                          <td className="px-4 py-3 text-center font-semibold" style={{ color: "#86efac" }}>
                            {league._count.players}
                          </td>
                          <td className="px-4 py-3">
                            <span className="flex items-center gap-1.5 text-xs font-medium">
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: dot.color }} />
                              <span style={{ color: dot.color }}>{dot.label}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              href={`/league/${league.slug}`}
                              className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors hover:opacity-80"
                              style={{ borderColor: "#2d5a2d", color: "#4ade80", background: "transparent" }}
                            >
                              Open →
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            REGULAR USER VIEW
        ══════════════════════════════════════════════════════════════════ */}
        {!isMasterAdmin && (
          <>
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold" style={{ color: "#f0fdf4" }}>My Leagues</h1>
                <p className="text-sm mt-1" style={{ color: "#4ade80" }}>
                  {leagueRoles.length === 0
                    ? "Get started by creating your first league"
                    : `You're part of ${leagueRoles.length} league${leagueRoles.length !== 1 ? "s" : ""}`}
                </p>
              </div>
              <Link href="/register">
                <button
                  className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all"
                  style={{
                    background: "linear-gradient(135deg, #16a34a, #15803d)",
                    color: "#fff",
                    boxShadow: "0 0 16px rgba(74,222,128,0.25)",
                  }}
                >
                  <span className="text-base">+</span> New league
                </button>
              </Link>
            </div>

            {leagueRoles.length === 0 ? (
              <div
                className="rounded-2xl border text-center py-20 px-6"
                style={{ borderColor: "#1e3a1e", background: "#0f2310" }}
              >
                <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center text-3xl" style={{ background: "#1a3d1a" }}>
                  ⚾
                </div>
                <h2 className="text-xl font-semibold mb-2" style={{ color: "#f0fdf4" }}>No leagues yet</h2>
                <p className="mb-6 text-sm" style={{ color: "#4ade80" }}>
                  Create your first league and start managing your season.
                </p>
                <Link href="/register">
                  <button
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-sm"
                    style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", color: "#fff" }}
                  >
                    Create a league
                  </button>
                </Link>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {leagueRoles.map(({ league, role }) => (
                  <Link key={league.id} href={`/league/${league.slug}`} className="group block">
                    <div
                      className="rounded-2xl border p-5 h-full transition-all duration-200 group-hover:scale-[1.02] group-hover:border-[#4ade80] group-hover:shadow-[0_0_20px_rgba(74,222,128,0.15)]"
                      style={{ borderColor: "#1e3a1e", background: "#0f2310", boxShadow: "0 2px 8px rgba(0,0,0,0.4)" }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold" style={{ background: "#1a3d1a", color: "#4ade80" }}>
                          {league.name.charAt(0).toUpperCase()}
                        </div>
                        <span className={`text-xs font-medium border rounded-full px-2.5 py-0.5 ${roleColor(role)}`}>
                          {roleLabel(role)}
                        </span>
                      </div>
                      <h3 className="font-bold text-base mb-1 group-hover:text-green-300 transition-colors" style={{ color: "#f0fdf4" }}>
                        {league.name}
                      </h3>
                      {(league.city || league.state) && (
                        <p className="text-xs mb-3" style={{ color: "#4ade80" }}>
                          📍 {[league.city, league.state].filter(Boolean).join(", ")}
                        </p>
                      )}
                      <div className="flex gap-3 mt-4 pt-3 border-t" style={{ borderColor: "#1e3a1e" }}>
                        <div className="flex-1 text-center">
                          <p className="text-xl font-bold" style={{ color: "#4ade80" }}>{league._count.seasons}</p>
                          <p className="text-xs" style={{ color: "#6b7280" }}>season{league._count.seasons !== 1 ? "s" : ""}</p>
                        </div>
                        <div className="w-px" style={{ background: "#1e3a1e" }} />
                        <div className="flex-1 text-center">
                          <p className="text-xl font-bold" style={{ color: "#4ade80" }}>{league._count.teams}</p>
                          <p className="text-xs" style={{ color: "#6b7280" }}>team{league._count.teams !== 1 ? "s" : ""}</p>
                        </div>
                      </div>
                      <div className="mt-4 text-center text-xs font-medium py-2 rounded-lg transition-colors group-hover:bg-green-700" style={{ background: "#1a3d1a", color: "#4ade80" }}>
                        Open league →
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
