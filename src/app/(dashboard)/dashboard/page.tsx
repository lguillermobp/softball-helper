import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LeagueCard } from "@/components/league-card";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userWithLeagues = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      leagueRoles: {
        include: {
          league: {
            include: { seasons: true, teams: true },
          },
        },
      },
    },
  });

  const leagueRoles = userWithLeagues?.leagueRoles ?? [];

  function roleLabel(r: string) {
    return r.replace(/_/g, " ");
  }

  function roleColor(r: string) {
    if (r === "LEAGUE_ADMIN") return "bg-amber-400/20 text-amber-300 border-amber-400/30";
    if (r === "UMPIRE") return "bg-blue-400/20 text-blue-300 border-blue-400/30";
    if (r === "SCORER") return "bg-purple-400/20 text-purple-300 border-purple-400/30";
    if (r === "TEAM_MANAGER") return "bg-cyan-400/20 text-cyan-300 border-cyan-400/30";
    return "bg-green-400/20 text-green-300 border-green-400/30";
  }

  return (
    <div className="min-h-screen" style={{ background: "#0a1a0a" }}>
      {/* ── Header ── */}
      <header
        className="border-b sticky top-0 z-10"
        style={{ borderColor: "#1e3a1e", background: "#0f2310" }}
      >
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Baseball stitch icon */}
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
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: "#1a3d1a", color: "#4ade80", border: "1px solid #2d5a2d" }}
              >
                {session.user.name?.charAt(0).toUpperCase() ?? "?"}
              </div>
              <span className="text-sm" style={{ color: "#86efac" }}>
                {session.user.name}
              </span>
            </div>
            <form action="/api/auth/signout" method="POST">
              <button
                type="submit"
                className="text-sm px-3 py-1.5 rounded-md border transition-colors"
                style={{
                  borderColor: "#2d5a2d",
                  color: "#86efac",
                  background: "transparent",
                }}
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* ── Page title ── */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "#f0fdf4" }}>
              My Leagues
            </h1>
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

        {/* ── Empty state ── */}
        {leagueRoles.length === 0 ? (
          <div
            className="rounded-2xl border text-center py-20 px-6"
            style={{ borderColor: "#1e3a1e", background: "#0f2310" }}
          >
            {/* Softball emoji replacement */}
            <div
              className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center text-3xl"
              style={{ background: "#1a3d1a" }}
            >
              ⚾
            </div>
            <h2 className="text-xl font-semibold mb-2" style={{ color: "#f0fdf4" }}>
              No leagues yet
            </h2>
            <p className="mb-6 text-sm" style={{ color: "#4ade80" }}>
              Create your first league and start managing your season.
            </p>
            <Link href="/register">
              <button
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-sm"
                style={{
                  background: "linear-gradient(135deg, #16a34a, #15803d)",
                  color: "#fff",
                }}
              >
                Create a league
              </button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {leagueRoles.map(({ league, role }: { league: any; role: string }) => (
              <LeagueCard
                key={league.id}
                league={league}
                role={role}
                roleLabel={roleLabel}
                roleColor={roleColor}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

