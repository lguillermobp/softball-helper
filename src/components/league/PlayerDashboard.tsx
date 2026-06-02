"use client";

import { useState } from "react";
import Link from "next/link";
import { TeamAvatar } from "@/components/ui/TeamAvatar";
import { flagUrl } from "@/lib/countries";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Teammate {
  id: string; name: string;
  jerseyNumber: string | null; nationality: string | null; photoUrl: string | null;
}

interface GameEntry {
  gameId: string; seasonId: string; seasonName: string; date: string;
  opponentName: string; position: string; battingOrder: number | null;
  teamScore: number | null; opponentScore: number | null;
  status: string; result: "W" | "L" | "T" | null;
}

interface PlayerStats {
  gamesPlayed: number; wins: number; losses: number; ties: number;
  positions: Record<string, number>; recentGames: GameEntry[];
}

interface ScheduleEntry {
  gameId: string; seasonId: string; seasonName: string; date: string;
  homeTeamName: string; awayTeamName: string;
  isMyTeamHome: boolean;
  homeScore: number | null; awayScore: number | null;
  status: string; result: "W" | "L" | "T" | null;
}

interface BattingLine {
  ab: number; h: number; singles: number; doubles: number; triples: number; hr: number; ba: string;
}

interface UnofficialGameStats {
  gameId: string; date: string; opponentName: string;
  ab: number; h: number; singles: number; doubles: number; triples: number; hr: number; ba: string;
}

interface UnofficialStats {
  seasonTotals: BattingLine | null;
  perGame: UnofficialGameStats[];
}

interface MyTeam {
  id: string; name: string; logoUrl: string | null;
  manager: { name: string | null; email: string; phone: string | null } | null;
  assistant: { name: string | null; email: string; phone: string | null } | null;
  teammates: Teammate[];
  stats: PlayerStats;
  schedule: ScheduleEntry[];
  unofficialStats: UnofficialStats | null;
}

interface Season { id: string; name: string; startDate: string; endDate: string; status: string }

interface Props {
  slug: string;
  league: { name: string; city: string | null; state: string | null };
  myTeams: MyTeam[];
  seasons: Season[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type TeamTab = "schedule" | "stats" | "roster";

function resultStyle(r: "W" | "L" | "T" | null) {
  if (r === "W") return { color: "#4ade80", bg: "#14532d" };
  if (r === "L") return { color: "#f87171", bg: "#450a0a" };
  if (r === "T") return { color: "#fbbf24", bg: "#451a03" };
  return { color: "#9ca3af", bg: "#1f2937" };
}

function statusLabel(s: string) {
  if (s === "IN_PROGRESS") return { text: "Live", color: "#fbbf24" };
  if (s === "COMPLETED")   return { text: "Final", color: "#9ca3af" };
  if (s === "CANCELLED")   return { text: "Cancelled", color: "#f87171" };
  return { text: "Scheduled", color: "var(--sh-primary)" };
}

const card = { borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" };
const dim  = { color: "var(--sh-muted)" };
const head = { color: "var(--sh-text)" };

function Avatar({ name, photoUrl, size = 10 }: { name: string; photoUrl: string | null; size?: number }) {
  return photoUrl
    ? <img src={photoUrl} alt={name} className={`w-${size} h-${size} rounded-full object-cover shrink-0`} style={{ border: "2px solid var(--sh-border2)" }} />
    : (
      <div className={`w-${size} h-${size} rounded-full flex items-center justify-center text-xs font-bold shrink-0`}
        style={{ background: "var(--sh-bg-card2)", color: "var(--sh-primary)", border: "2px solid var(--sh-border2)" }}>
        {name.charAt(0).toUpperCase()}
      </div>
    );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ScheduleTab({ team, slug }: { team: MyTeam; slug: string }) {
  if (team.schedule.length === 0) {
    return <div className="px-5 py-8 text-center text-sm" style={dim}>No games scheduled yet.</div>;
  }

  // Group by season (newest first)
  const bySeasonMap = new Map<string, { seasonId: string; seasonName: string; games: ScheduleEntry[] }>();
  for (const g of team.schedule) {
    if (!bySeasonMap.has(g.seasonId)) bySeasonMap.set(g.seasonId, { seasonId: g.seasonId, seasonName: g.seasonName, games: [] });
    bySeasonMap.get(g.seasonId)!.games.push(g);
  }
  const seasons = [...bySeasonMap.values()].reverse();

  return (
    <div className="divide-y" style={{ borderColor: "var(--sh-border)" }}>
      {seasons.map(({ seasonId, seasonName, games }) => (
        <div key={seasonId} className="px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--sh-primary)" }}>
              📅 {seasonName}
            </p>
            <Link href={`/league/${slug}/season/${seasonId}`} className="text-xs hover:underline" style={{ color: "var(--sh-muted)" }}>
              Full standings →
            </Link>
          </div>
          <div className="space-y-2">
            {games.map(g => {
              const d = new Date(g.date);
              const rs = resultStyle(g.result);
              const sl = statusLabel(g.status);
              const myScore  = g.isMyTeamHome ? g.homeScore : g.awayScore;
              const oppScore = g.isMyTeamHome ? g.awayScore : g.homeScore;
              const opponent = g.isMyTeamHome ? g.awayTeamName : g.homeTeamName;
              return (
                <div key={g.gameId} className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-xs"
                  style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card2)" }}>
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="shrink-0" style={dim}>
                      {d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                    <span className="font-semibold truncate" style={head}>
                      {g.isMyTeamHome ? "vs" : "@"} {opponent}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {g.status === "COMPLETED" && myScore !== null && oppScore !== null ? (
                      <>
                        <span className="font-bold" style={head}>{myScore} – {oppScore}</span>
                        <span className="font-bold rounded-full px-2 py-0.5" style={{ background: rs.bg, color: rs.color }}>
                          {g.result}
                        </span>
                      </>
                    ) : (
                      <span style={{ color: sl.color }}>{sl.text}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatsTab({ team, slug }: { team: MyTeam; slug: string }) {
  const [showAllGames, setShowAllGames] = useState(false);
  const s = team.stats;
  const completedGames = s.recentGames.filter(g => g.status === "COMPLETED");
  const pct = completedGames.length > 0 ? ((s.wins / completedGames.length) * 100).toFixed(0) : null;
  const topPositions = Object.entries(s.positions).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const u = team.unofficialStats;

  return (
    <div className="divide-y" style={{ borderColor: "var(--sh-border)" }}>

      {/* ── Official Record ─────────────────────────────────────────────────── */}
      <div className="px-5 py-4 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--sh-primary)" }}>
          🏆 Official Record
        </p>

        {s.gamesPlayed === 0 ? (
          <p className="text-xs" style={dim}>No game appearances recorded yet.</p>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Games",  value: s.gamesPlayed },
                { label: "Wins",   value: s.wins,   color: "#4ade80" },
                { label: "Losses", value: s.losses, color: "#f87171" },
                { label: "Win %",  value: pct ? `${pct}%` : "—" },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-xl border p-2.5 text-center"
                  style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card2)" }}>
                  <p className="text-lg font-bold" style={{ color: color ?? "var(--sh-text)" }}>{value}</p>
                  <p className="text-xs mt-0.5" style={dim}>{label}</p>
                </div>
              ))}
            </div>

            {topPositions.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs" style={dim}>Positions:</span>
                {topPositions.map(([pos, cnt]) => (
                  <span key={pos} className="text-xs font-semibold rounded-full px-2.5 py-0.5"
                    style={{ background: "var(--sh-bg-card2)", color: "var(--sh-primary)", border: "1px solid var(--sh-border2)" }}>
                    {pos} <span style={dim}>×{cnt}</span>
                  </span>
                ))}
              </div>
            )}

            {s.recentGames.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={dim}>Game log</p>
                <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--sh-border)" }}>
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ background: "var(--sh-bg-card2)", borderBottom: "1px solid var(--sh-border)" }}>
                        {["Date", "Opponent", "Pos", "Score", "Result"].map(h => (
                          <th key={h} className="px-3 py-2 text-left font-semibold uppercase tracking-wider" style={dim}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(showAllGames ? s.recentGames : s.recentGames.slice(0, 6)).map(g => {
                        const rs = resultStyle(g.result);
                        return (
                          <tr key={g.gameId} style={{ borderBottom: "1px solid var(--sh-border)" }}>
                            <td className="px-3 py-2 whitespace-nowrap" style={dim}>
                              {new Date(g.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                            </td>
                            <td className="px-3 py-2 font-medium" style={head}>{g.opponentName}</td>
                            <td className="px-3 py-2 font-semibold" style={{ color: "var(--sh-primary)" }}>{g.position}</td>
                            <td className="px-3 py-2 whitespace-nowrap" style={head}>
                              {g.teamScore !== null && g.opponentScore !== null
                                ? `${g.teamScore} – ${g.opponentScore}`
                                : g.status === "IN_PROGRESS" ? "Live" : "—"}
                            </td>
                            <td className="px-3 py-2">
                              {g.result
                                ? <span className="font-bold rounded-full px-2 py-0.5" style={{ background: rs.bg, color: rs.color }}>{g.result}</span>
                                : <span style={dim}>{g.status === "IN_PROGRESS" ? "●" : "—"}</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {s.recentGames.length > 6 && (
                  <button onClick={() => setShowAllGames(v => !v)}
                    className="mt-2 text-xs hover:underline" style={{ color: "var(--sh-primary)" }}>
                    {showAllGames ? "Show less" : `Show all ${s.recentGames.length} games`}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Manager's Record (Unofficial) ────────────────────────────────────── */}
      <div className="px-5 py-4 space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#fbbf24" }}>
            📓 Manager&apos;s Record
          </p>
          <span className="text-xs font-semibold rounded-full px-2 py-0.5"
            style={{ background: "var(--sh-bg-card2)", color: "#fbbf24", border: "1px solid var(--sh-border2)" }}>
            Unofficial
          </span>
        </div>
        <p className="text-xs" style={dim}>
          Recorded by the team manager. Not the official league statistics.
        </p>

        {!u || (!u.seasonTotals && u.perGame.length === 0) ? (
          <p className="text-xs" style={dim}>No scorebook data recorded yet.</p>
        ) : (
          <>
            {/* Season batting totals */}
            {u.seasonTotals && u.seasonTotals.ab > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={dim}>Season batting totals</p>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                  {[
                    { label: "AB", value: u.seasonTotals.ab },
                    { label: "H",  value: u.seasonTotals.h,       color: "#4ade80" },
                    { label: "1B", value: u.seasonTotals.singles },
                    { label: "2B", value: u.seasonTotals.doubles,  color: "#93c5fd" },
                    { label: "3B", value: u.seasonTotals.triples,  color: "#a78bfa" },
                    { label: "HR", value: u.seasonTotals.hr,       color: "#fcd34d" },
                    { label: "BA", value: u.seasonTotals.ba,       color: "var(--sh-text)" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="rounded-xl border p-2 text-center"
                      style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card2)" }}>
                      <p className="text-base font-bold" style={{ color: color ?? "var(--sh-muted)" }}>{value}</p>
                      <p className="text-xs mt-0.5" style={dim}>{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Per-game breakdown */}
            {u.perGame.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={dim}>Game by game</p>
                <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--sh-border)" }}>
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ background: "var(--sh-bg-card2)", borderBottom: "1px solid var(--sh-border)" }}>
                        {["Date", "Opponent", "AB", "H", "1B", "2B", "3B", "HR", "BA"].map(h => (
                          <th key={h} className="px-2 py-2 text-center first:text-left font-semibold uppercase tracking-wider" style={dim}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {u.perGame.map((g, i) => (
                        <tr key={g.gameId} style={{ borderBottom: i < u.perGame.length - 1 ? "1px solid var(--sh-border)" : "none" }}>
                          <td className="px-2 py-2 whitespace-nowrap" style={dim}>
                            {new Date(g.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </td>
                          <td className="px-2 py-2 font-medium" style={head}>{g.opponentName}</td>
                          <td className="px-2 py-2 text-center" style={dim}>{g.ab}</td>
                          <td className="px-2 py-2 text-center font-semibold" style={{ color: "#4ade80" }}>{g.h}</td>
                          <td className="px-2 py-2 text-center" style={dim}>{g.singles}</td>
                          <td className="px-2 py-2 text-center" style={{ color: "#93c5fd" }}>{g.doubles}</td>
                          <td className="px-2 py-2 text-center" style={{ color: "#a78bfa" }}>{g.triples}</td>
                          <td className="px-2 py-2 text-center font-semibold" style={{ color: "#fcd34d" }}>{g.hr}</td>
                          <td className="px-2 py-2 text-center font-bold" style={head}>{g.ba}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function RosterTab({ teammates }: { teammates: Teammate[] }) {
  if (teammates.length === 0) {
    return <div className="px-5 py-8 text-center text-sm" style={dim}>No players yet.</div>;
  }
  return (
    <div className="px-5 py-4">
      <div className="grid gap-2.5 sm:grid-cols-2">
        {teammates.map(p => (
          <div key={p.id} className="flex items-center gap-2.5">
            <Avatar name={p.name} photoUrl={p.photoUrl} size={9} />
            <div className="min-w-0">
              <p className="text-sm font-medium flex items-center gap-1.5" style={head}>
                {p.nationality && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={flagUrl(p.nationality)} alt={p.nationality} className="w-5 shrink-0" style={{ height: "14px", objectFit: "cover", borderRadius: "2px" }} />
                )}
                <span className="truncate">{p.name}</span>
              </p>
              {p.jerseyNumber && <p className="text-xs" style={{ color: "var(--sh-primary)" }}>#{p.jerseyNumber}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PlayerDashboard({ slug, myTeams, seasons }: Props) {
  const [tabs, setTabs] = useState<Record<string, TeamTab>>({});
  const getTab = (teamId: string): TeamTab => tabs[teamId] ?? "schedule";
  const setTab = (teamId: string, t: TeamTab) => setTabs(prev => ({ ...prev, [teamId]: t }));

  const TAB_DEFS: { key: TeamTab; label: string }[] = [
    { key: "schedule", label: "📅 Schedule" },
    { key: "stats",    label: "📊 Stats"    },
    { key: "roster",   label: "👥 Roster"   },
  ];

  return (
    <div className="space-y-8">
      {myTeams.length === 0 ? (
        <div className="rounded-2xl border py-10 text-center text-sm" style={{ ...card, color: "var(--sh-muted)" }}>
          You are not assigned to any team yet.
        </div>
      ) : myTeams.map(team => {
        const activeTab = getTab(team.id);
        return (
          <div key={team.id} className="rounded-2xl border overflow-hidden" style={card}>
            {/* Team header */}
            <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--sh-border)" }}>
              <div className="flex items-center gap-3 mb-2">
                <TeamAvatar name={team.name} logoUrl={team.logoUrl} size={12} />
                <p className="font-bold text-base" style={head}>{team.name}</p>
              </div>
              {team.manager && (
                <p className="text-xs mt-1" style={dim}>
                  <span className="font-semibold" style={{ color: "var(--sh-primary)" }}>Manager</span>
                  {" · "}<span style={head}>{team.manager.name ?? "—"}</span>
                  {team.manager.email && (
                    <a href={`mailto:${team.manager.email}`} className="ml-1 hover:underline" style={{ color: "var(--sh-secondary)" }}>
                      {team.manager.email}
                    </a>
                  )}
                  {team.manager.phone && <span> · {team.manager.phone}</span>}
                </p>
              )}
              {team.assistant && (
                <p className="text-xs mt-0.5" style={dim}>
                  <span className="font-semibold" style={{ color: "var(--sh-secondary)" }}>Assistant</span>
                  {" · "}<span style={head}>{team.assistant.name ?? "—"}</span>
                  {team.assistant.email && (
                    <a href={`mailto:${team.assistant.email}`} className="ml-1 hover:underline" style={{ color: "var(--sh-secondary)" }}>
                      {team.assistant.email}
                    </a>
                  )}
                </p>
              )}
            </div>

            {/* Tab strip */}
            <div className="flex gap-1 px-4 py-2" style={{ borderBottom: "1px solid var(--sh-border)", background: "var(--sh-bg-card2)" }}>
              {TAB_DEFS.map(t => (
                <button key={t.key} onClick={() => setTab(team.id, t.key)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={activeTab === t.key
                    ? { background: "var(--sh-primary-dark)", color: "#fff" }
                    : { color: "var(--sh-primary)", background: "transparent" }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {activeTab === "schedule" && <ScheduleTab team={team} slug={slug} />}
            {activeTab === "stats"    && <StatsTab    team={team} slug={slug} />}
            {activeTab === "roster"   && <RosterTab   teammates={team.teammates} />}
          </div>
        );
      })}

      {/* Seasons (secondary, kept for browsing standings) */}
      {seasons.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-bold" style={head}>📅 Seasons</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {seasons.map(season => {
              const badge = season.status === "ACTIVE"
                ? { bg: "#14532d", color: "#4ade80", text: "Active" }
                : season.status === "COMPLETED"
                  ? { bg: "#1f2937", color: "#9ca3af", text: "Completed" }
                  : { bg: "#78350f", color: "#fbbf24", text: "Upcoming" };
              return (
                <Link key={season.id} href={`/league/${slug}/season/${season.id}`} className="group block">
                  <div className="rounded-xl border p-4 flex items-center justify-between transition-opacity group-hover:opacity-80" style={card}>
                    <div>
                      <p className="font-semibold" style={head}>{season.name}</p>
                      <p className="text-xs mt-0.5" style={dim}>
                        {new Date(season.startDate).toLocaleDateString()} – {new Date(season.endDate).toLocaleDateString()}
                      </p>
                      <p className="text-xs mt-1" style={{ color: "var(--sh-primary)" }}>Standings & schedule →</p>
                    </div>
                    <span className="text-xs font-semibold rounded-full px-3 py-1 shrink-0"
                      style={{ background: badge.bg, color: badge.color }}>{badge.text}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
