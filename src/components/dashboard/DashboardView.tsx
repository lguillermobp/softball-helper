"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useLanguage } from "@/context/language-context";
import { LanguageSelector } from "@/components/ui/language-selector";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { SignOutButton } from "@/components/ui/sign-out-button";
import { ChangePasswordButton } from "@/components/ui/change-password-button";
import { DashboardSchedule, type ScheduleGame, type StatRow } from "./DashboardSchedule";

interface LeagueSummary {
  id: string; name: string; slug: string;
  city: string | null; state: string | null;
  status: string; plan: { name: string };
  _count: { seasons: number; teams: number; players: number };
}

interface LeagueRole {
  role: string;
  league: {
    id: string; name: string; slug: string;
    city: string | null; state: string | null;
    _count: { seasons: number; teams: number };
  };
}

interface Props {
  isMasterAdmin: boolean;
  isSupportTechnician?: boolean;
  userName: string | null | undefined;
  allLeagues: LeagueSummary[];
  leagueRoles: LeagueRole[];
  scheduleGames?: ScheduleGame[];
  stats?: StatRow[];
  hasPlayingRole?: boolean;
}

function roleColor(r: string) {
  if (r === "LEAGUE_ADMIN")  return "bg-amber-400/20 text-amber-300 border-amber-400/30";
  if (r === "UMPIRE")        return "bg-blue-400/20 text-blue-300 border-blue-400/30";
  if (r === "SCOREKEEPER")   return "bg-purple-400/20 text-purple-300 border-purple-400/30";
  if (r === "TEAM_MANAGER")          return "bg-cyan-400/20 text-cyan-300 border-cyan-400/30";
  if (r === "TEAM_MANAGER_PLAYER")   return "bg-teal-400/20 text-teal-300 border-teal-400/30";
  if (r === "TEAM_ASSISTANT")        return "bg-sky-400/20 text-sky-300 border-sky-400/30";
  if (r === "TEAM_ASSISTANT_PLAYER") return "bg-indigo-400/20 text-indigo-300 border-indigo-400/30";
  return "bg-green-400/20 text-green-300 border-green-400/30";
}

type UserTab = "leagues" | "schedule";

function DeleteLeagueDialog({ league, onDeleted }: { league: LeagueSummary; onDeleted: () => void }) {
  const [open, setOpen]       = useState(false);
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  async function handleDelete() {
    setLoading(true); setError("");
    const res = await fetch(`/api/admin/leagues/${league.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmName: confirm }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Something went wrong");
      return;
    }
    setOpen(false);
    onDeleted();
  }

  const modal = open && mounted ? createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
      <div className="rounded-2xl border p-6 w-full max-w-md shadow-xl" style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" }}>
        <h3 className="text-lg font-bold mb-2" style={{ color: "var(--sh-text)" }}>Delete League</h3>
        <p className="text-sm mb-4" style={{ color: "var(--sh-muted)" }}>
          This will permanently delete <strong style={{ color: "var(--sh-text)" }}>{league.name}</strong> and all of its data
          (seasons, games, teams, players, fields, members). The Stripe subscription will be cancelled.
          This action cannot be undone.
        </p>
        <p className="text-sm mb-2" style={{ color: "var(--sh-muted)" }}>
          Type <strong style={{ color: "#ef4444" }}>{league.name}</strong> to confirm:
        </p>
        <input
          autoFocus
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          placeholder={league.name}
          className="w-full rounded-lg border px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-500"
          style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card2)", color: "var(--sh-text)" }}
        />
        {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setOpen(false)}
            className="px-4 py-2 text-sm rounded-lg border transition-colors hover:opacity-80"
            style={{ borderColor: "var(--sh-border2)", color: "var(--sh-muted)", background: "transparent" }}>
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={loading || confirm !== league.name}
            className="px-4 py-2 text-sm font-semibold rounded-lg transition-colors disabled:opacity-40"
            style={{ background: "#ef4444", color: "#fff" }}>
            {loading ? "Deleting…" : "Delete permanently"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button
        onClick={() => { setOpen(true); setConfirm(""); setError(""); }}
        className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors hover:opacity-80"
        style={{ borderColor: "#ef4444", color: "#ef4444", background: "transparent" }}>
        Delete
      </button>
      {modal}
    </>
  );
}

export function DashboardView({ isMasterAdmin, isSupportTechnician, userName, allLeagues, leagueRoles, scheduleGames = [], stats = [], hasPlayingRole = false }: Props) {
  const { t } = useLanguage();
  const d = t.dashboard;
  const [userTab, setUserTab] = useState<UserTab>("leagues");
  const [leagues, setLeagues] = useState(allLeagues);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function toggleStatus(league: LeagueSummary) {
    const next = league.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";
    setTogglingId(league.id);
    const res = await fetch(`/api/admin/leagues/${league.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setTogglingId(null);
    if (res.ok) {
      setLeagues(prev => prev.map(l => l.id === league.id ? { ...l, status: next } : l));
    }
  }

  function removeLeague(id: string) {
    setLeagues(prev => prev.filter(l => l.id !== id));
  }

  function statusInfo(s: string) {
    if (s === "ACTIVE")    return { color: "#4ade80", label: d.active };
    if (s === "SUSPENDED") return { color: "#f87171", label: d.suspended };
    return { color: "#9ca3af", label: d.archived };
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--sh-bg-page)" }}>
      {/* ── Header ── */}
      <header className="border-b sticky top-0 z-10" style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-header)" }}>
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="13" fill="var(--sh-bg-card2)" stroke="var(--sh-primary)" strokeWidth="1.5"/>
              <path d="M8 10 C10 8, 10 6, 12 5" stroke="var(--sh-primary)" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
              <path d="M8 14 C10 12, 10 10, 12 9" stroke="var(--sh-primary)" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
              <path d="M8 18 C10 16, 10 14, 12 13" stroke="var(--sh-primary)" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
              <path d="M20 10 C18 8, 18 6, 16 5" stroke="var(--sh-primary)" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
              <path d="M20 14 C18 12, 18 10, 16 9" stroke="var(--sh-primary)" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
              <path d="M20 18 C18 16, 18 14, 16 13" stroke="var(--sh-primary)" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
            </svg>
            <span className="text-lg font-bold tracking-tight" style={{ color: "var(--sh-primary)" }}>Softball Helper</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: "var(--sh-bg-card2)", color: "var(--sh-primary)", border: "1px solid var(--sh-border2)" }}>
                {userName?.charAt(0).toUpperCase() ?? "?"}
              </div>
              <span className="text-sm" style={{ color: "var(--sh-secondary)" }}>{userName}</span>
            </div>
            <ThemeToggle />
            <LanguageSelector />
            <ChangePasswordButton />
            <SignOutButton label={d.signOut} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">

        {/* ══ Master Admin ══ */}
        {isMasterAdmin && (
          <>
            {/* Title row */}
            <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
              <div>
                <h1 className="text-2xl font-bold" style={{ color: "var(--sh-text)" }}>{d.systemOverview}</h1>
                <p className="text-sm mt-1" style={{ color: "var(--sh-purple)" }}>
                  {allLeagues.length} {d.systemSubtitle}
                </p>
              </div>
              <Link href="/register">
                <button className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm"
                  style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", color: "#fff", boxShadow: "0 0 16px rgba(74,222,128,0.25)" }}>
                  <span>+</span> {d.newLeague}
                </button>
              </Link>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {[
                { label: d.totalLeagues,  value: leagues.length },
                { label: d.activeLeagues, value: leagues.filter((l) => l.status === "ACTIVE").length },
                { label: d.totalTeams,    value: leagues.reduce((s, l) => s + l._count.teams, 0) },
                { label: d.totalPlayers,  value: leagues.reduce((s, l) => s + l._count.players, 0) },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl border p-4 text-center"
                  style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" }}>
                  <p className="text-3xl font-bold" style={{ color: "var(--sh-purple)" }}>{stat.value}</p>
                  <p className="text-xs mt-1" style={{ color: "var(--sh-muted)" }}>{stat.label}</p>
                </div>
              ))}
            </div>

            {/* System tools */}
            <div className="mb-8">
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--sh-muted)" }}>System Tools</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                {[
                  { href: "/admin/users",         icon: "👥", label: "Users",         desc: "Manage accounts" },
                  { href: "/admin/plans",         icon: "📋", label: "Plans",         desc: "Subscription plans" },
                  { href: "/admin/subscriptions", icon: "📊", label: "Subscriptions", desc: "League subscriptions" },
                  { href: "/admin/coupons",       icon: "🏷️", label: "Coupons",       desc: "Discount codes" },
                  { href: "/admin/audit",         icon: "📜", label: "Audit Log",     desc: "Activity history" },
                  { href: "/admin/cleanup",       icon: "🗑️", label: "Cleanup",       desc: "Data maintenance" },
                  { href: "/support",             icon: "🎫", label: "Support",       desc: "Tickets & help" },
                ].map(({ href, icon, label, desc }) => (
                  <Link key={href} href={href}
                    className="group rounded-xl border p-4 flex flex-col items-center gap-2 text-center transition-all hover:scale-[1.03] hover:shadow-md"
                    style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" }}>
                    <span className="text-2xl">{icon}</span>
                    <div>
                      <p className="text-sm font-bold" style={{ color: "var(--sh-text)" }}>{label}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--sh-muted)" }}>{desc}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Leagues table */}
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--sh-muted)" }}>Leagues</p>
            {leagues.length === 0 ? (
              <div className="rounded-2xl border py-16 text-center text-sm"
                style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card)", color: "var(--sh-primary)" }}>
                {d.noLeagues}
              </div>
            ) : (
              <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--sh-border)" }}>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--sh-muted)" }}>{d.title}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider hidden sm:table-cell" style={{ color: "var(--sh-muted)" }}>{d.location}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider hidden sm:table-cell" style={{ color: "var(--sh-muted)" }}>{d.plan}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider hidden sm:table-cell" style={{ color: "var(--sh-muted)" }}>Seasons</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider hidden sm:table-cell" style={{ color: "var(--sh-muted)" }}>Teams</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider hidden sm:table-cell" style={{ color: "var(--sh-muted)" }}>Players</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider hidden sm:table-cell" style={{ color: "var(--sh-muted)" }}>{d.status}</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {leagues.map((league) => {
                      const dot = statusInfo(league.status);
                      const isSuspended = league.status === "SUSPENDED";
                      return (
                        <tr key={league.id} className="transition-colors hover:brightness-110"
                          style={{ borderBottom: "1px solid var(--sh-border)" }}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
                                style={{ background: "var(--sh-bg-card2)", color: "var(--sh-primary)" }}>
                                {league.name.charAt(0).toUpperCase()}
                              </div>
                              <span className="font-semibold" style={{ color: "var(--sh-text)" }}>{league.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell" style={{ color: "var(--sh-muted)" }}>
                            {[league.city, league.state].filter(Boolean).join(", ") || "—"}
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <span className="text-xs font-medium rounded-full px-2 py-0.5"
                              style={{ background: "var(--sh-bg-card2)", color: "var(--sh-primary)" }}>
                              {league.plan.name}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center font-semibold hidden sm:table-cell" style={{ color: "var(--sh-secondary)" }}>{league._count.seasons}</td>
                          <td className="px-4 py-3 text-center font-semibold hidden sm:table-cell" style={{ color: "var(--sh-secondary)" }}>{league._count.teams}</td>
                          <td className="px-4 py-3 text-center font-semibold hidden sm:table-cell" style={{ color: "var(--sh-secondary)" }}>{league._count.players}</td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <span className="flex items-center gap-1.5 text-xs font-medium">
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: dot.color }} />
                              <span style={{ color: dot.color }}>{dot.label}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 justify-end">
                              <Link href={`/league/${league.slug}`}
                                className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors hover:opacity-80"
                                style={{ borderColor: "var(--sh-border2)", color: "var(--sh-primary)", background: "transparent" }}>
                                {d.open}
                              </Link>
                              <button
                                onClick={() => toggleStatus(league)}
                                disabled={togglingId === league.id}
                                className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors hover:opacity-80 disabled:opacity-50 hidden sm:inline-flex"
                                style={{
                                  borderColor: isSuspended ? "#22c55e" : "#f59e0b",
                                  color: isSuspended ? "#22c55e" : "#f59e0b",
                                  background: "transparent",
                                }}>
                                {togglingId === league.id ? "…" : isSuspended ? "Activate" : "Suspend"}
                              </button>
                              <DeleteLeagueDialog league={league} onDeleted={() => removeLeague(league.id)} />
                            </div>
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

        {/* ══ Regular User ══ */}
        {!isMasterAdmin && (
          <>
            <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
              <div>
                <h1 className="text-2xl font-bold" style={{ color: "var(--sh-text)" }}>{d.title}</h1>
                <p className="text-sm mt-1" style={{ color: "var(--sh-primary)" }}>
                  {leagueRoles.length === 0
                    ? d.noLeaguesDesc
                    : `${leagueRoles.length > 1 ? `${d.title} (${leagueRoles.length})` : leagueRoles[0]?.league.name}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isSupportTechnician && (
                  <Link href="/support"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm border transition-colors hover:opacity-80"
                    style={{ borderColor: "var(--sh-border2)", color: "var(--sh-secondary)", background: "transparent" }}>
                    🎫 Support
                  </Link>
                )}
                {!isSupportTechnician && (
                  <Link href="/support/tickets"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm border transition-colors hover:opacity-80"
                    style={{ borderColor: "var(--sh-border2)", color: "var(--sh-secondary)", background: "transparent" }}>
                    🎫 My Tickets
                  </Link>
                )}
                <Link href="/register">
                  <button className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm"
                    style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", color: "#fff", boxShadow: "0 0 16px rgba(74,222,128,0.25)" }}>
                    <span>+</span> {d.newLeague}
                  </button>
                </Link>
              </div>
            </div>

            {/* Tabs — only for users with schedule data */}
            {scheduleGames.length > 0 && (
              <div className="flex gap-1 mb-6 border-b" style={{ borderColor: "var(--sh-border)" }}>
                {(["leagues", "schedule"] as UserTab[]).map(tab => {
                  const labels: Record<UserTab, string> = { leagues: "My Leagues", schedule: "Schedule & Stats" };
                  const active = userTab === tab;
                  return (
                    <button key={tab} onClick={() => setUserTab(tab)}
                      className="px-4 py-2 text-sm font-semibold transition-colors relative"
                      style={{ color: active ? "var(--sh-primary)" : "var(--sh-muted)", background: "transparent", border: "none" }}>
                      {labels[tab]}
                      {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t" style={{ background: "var(--sh-primary)" }} />}
                      {tab === "schedule" && scheduleGames.some(g => g.status === "IN_PROGRESS") && (
                        <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Schedule tab */}
            {userTab === "schedule" && (
              <DashboardSchedule games={scheduleGames} stats={stats} hasPlayingRole={hasPlayingRole} />
            )}

            {/* Leagues tab */}
            {(userTab === "leagues" || scheduleGames.length === 0) && (leagueRoles.length === 0 ? (
              <div className="rounded-2xl border text-center py-20 px-6"
                style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" }}>
                <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center text-3xl"
                  style={{ background: "var(--sh-bg-card2)" }}>⚾</div>
                <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--sh-text)" }}>{d.noLeagues}</h2>
                <p className="mb-6 text-sm" style={{ color: "var(--sh-primary)" }}>{d.noLeaguesDesc}</p>
                <Link href="/register">
                  <button className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-sm"
                    style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", color: "#fff" }}>
                    {d.createLeague}
                  </button>
                </Link>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {leagueRoles.map(({ league, role }) => (
                  <Link key={league.id} href={`/league/${league.slug}`} className="group block">
                    <div className="rounded-2xl border p-5 h-full transition-all duration-200 group-hover:scale-[1.02] group-hover:shadow-lg"
                      style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card)", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold"
                          style={{ background: "var(--sh-bg-card2)", color: "var(--sh-primary)" }}>
                          {league.name.charAt(0).toUpperCase()}
                        </div>
                        <span className={`text-xs font-medium border rounded-full px-2.5 py-0.5 ${roleColor(role)}`}>
                          {role.replace(/_/g, " ")}
                        </span>
                      </div>
                      <h3 className="font-bold text-base mb-1 transition-colors" style={{ color: "var(--sh-text)" }}>
                        {league.name}
                      </h3>
                      {(league.city || league.state) && (
                        <p className="text-xs mb-3" style={{ color: "var(--sh-primary)" }}>
                          📍 {[league.city, league.state].filter(Boolean).join(", ")}
                        </p>
                      )}
                      <div className="flex gap-3 mt-4 pt-3 border-t" style={{ borderColor: "var(--sh-border)" }}>
                        <div className="flex-1 text-center">
                          <p className="text-xl font-bold" style={{ color: "var(--sh-primary)" }}>{league._count.seasons}</p>
                          <p className="text-xs" style={{ color: "var(--sh-muted)" }}>
                            {league._count.seasons === 1 ? d.season : d.seasons}
                          </p>
                        </div>
                        <div className="w-px" style={{ background: "var(--sh-border)" }} />
                        <div className="flex-1 text-center">
                          <p className="text-xl font-bold" style={{ color: "var(--sh-primary)" }}>{league._count.teams}</p>
                          <p className="text-xs" style={{ color: "var(--sh-muted)" }}>
                            {league._count.teams === 1 ? d.team : d.teams}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 text-center text-xs font-medium py-2 rounded-lg transition-colors"
                        style={{ background: "var(--sh-bg-card2)", color: "var(--sh-primary)" }}>
                        {d.openLeague}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ))}
          </>
        )}
      </main>
    </div>
  );
}
