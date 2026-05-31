"use client";

import Link from "next/link";
import { TeamAvatar } from "@/components/ui/TeamAvatar";
import { flagUrl } from "@/lib/countries";

interface Teammate {
  id: string;
  name: string;
  jerseyNumber: string | null;
  nationality: string | null;
  photoUrl: string | null;
}

interface GameEntry {
  gameId: string;
  seasonId: string;
  seasonName: string;
  date: string;
  opponentName: string;
  position: string;
  battingOrder: number | null;
  teamScore: number | null;
  opponentScore: number | null;
  status: string;
  result: "W" | "L" | "T" | null;
}

interface PlayerStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  ties: number;
  positions: Record<string, number>;
  recentGames: GameEntry[];
}

interface MyTeam {
  id: string;
  name: string;
  logoUrl: string | null;
  manager: { name: string | null; email: string; phone: string | null } | null;
  assistant: { name: string | null; email: string; phone: string | null } | null;
  teammates: Teammate[];
  stats: PlayerStats;
}

interface Season {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
}

interface Props {
  slug: string;
  league: { name: string; city: string | null; state: string | null };
  myTeams: MyTeam[];
  seasons: Season[];
}

function statusBadge(s: string) {
  if (s === "ACTIVE")    return { bg: "#14532d", color: "#4ade80", text: "Active" };
  if (s === "COMPLETED") return { bg: "#1f2937", color: "#9ca3af", text: "Completed" };
  return { bg: "#78350f", color: "#fbbf24", text: "Upcoming" };
}

function resultStyle(r: "W" | "L" | "T" | null) {
  if (r === "W") return { color: "#4ade80", bg: "#14532d" };
  if (r === "L") return { color: "#f87171", bg: "#450a0a" };
  if (r === "T") return { color: "#fbbf24", bg: "#451a03" };
  return { color: "#9ca3af", bg: "#1f2937" };
}

const card = { borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" };
const dim  = { color: "var(--sh-muted)" };
const head = { color: "var(--sh-text)" };

function Avatar({ name, photoUrl, size = 10 }: { name: string; photoUrl: string | null; size?: number }) {
  const cls = `w-${size} h-${size} rounded-full object-cover shrink-0`;
  return photoUrl
    ? <img src={photoUrl} alt={name} className={cls} style={{ border: "2px solid var(--sh-border2)" }} />
    : (
      <div className={`w-${size} h-${size} rounded-full flex items-center justify-center text-xs font-bold shrink-0`}
        style={{ background: "var(--sh-bg-card2)", color: "var(--sh-primary)", border: "2px solid var(--sh-border2)" }}>
        {name.charAt(0).toUpperCase()}
      </div>
    );
}

export function PlayerDashboard({ slug, myTeams, seasons }: Props) {
  return (
    <div className="space-y-8">

      {/* ── My Teams ── */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold" style={head}>⚾ My Team{myTeams.length !== 1 ? "s" : ""}</h2>

        {myTeams.length === 0 ? (
          <div className="rounded-2xl border py-10 text-center text-sm" style={{ ...card, color: "var(--sh-muted)" }}>
            You are not assigned to any team yet.
          </div>
        ) : myTeams.map((team) => (
          <div key={team.id} className="rounded-2xl border overflow-hidden" style={card}>
            {/* Team header */}
            <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--sh-border)" }}>
              <div className="flex items-center gap-3 mb-2">
                <TeamAvatar name={team.name} logoUrl={team.logoUrl} size={12} />
                <p className="font-bold text-base" style={head}>{team.name}</p>
              </div>
              {team.manager && (
                <p className="text-xs mt-1.5" style={dim}>
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

            {/* Roster with photos */}
            <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--sh-border)" }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={dim}>
                Roster ({team.teammates.length})
              </p>
              {team.teammates.length === 0 ? (
                <p className="text-xs" style={dim}>No players yet.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {team.teammates.map((p) => (
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
                        {p.jerseyNumber && (
                          <p className="text-xs" style={{ color: "var(--sh-primary)" }}>#{p.jerseyNumber}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Stats */}
            <StatsSection slug={slug} stats={team.stats} />
          </div>
        ))}
      </section>

      {/* ── Seasons ── */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold" style={head}>📅 Seasons</h2>
        {seasons.length === 0 ? (
          <div className="rounded-2xl border py-10 text-center text-sm" style={{ ...card, color: "var(--sh-muted)" }}>
            No seasons yet.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {seasons.map((season) => {
              const badge = statusBadge(season.status);
              return (
                <Link key={season.id} href={`/league/${slug}/season/${season.id}`} className="group block">
                  <div className="rounded-xl border p-4 flex items-center justify-between transition-opacity group-hover:opacity-80" style={card}>
                    <div>
                      <p className="font-semibold" style={head}>{season.name}</p>
                      <p className="text-xs mt-0.5" style={dim}>
                        {new Date(season.startDate).toLocaleDateString()} – {new Date(season.endDate).toLocaleDateString()}
                      </p>
                      <p className="text-xs mt-1" style={{ color: "var(--sh-primary)" }}>View schedule & standings →</p>
                    </div>
                    <span className="text-xs font-semibold rounded-full px-3 py-1 shrink-0"
                      style={{ background: badge.bg, color: badge.color }}>
                      {badge.text}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function StatsSection({ slug, stats }: { slug: string; stats: PlayerStats }) {
  const topPositions = Object.entries(stats.positions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const completedGames = stats.recentGames.filter((g) => g.status === "COMPLETED");
  const pct = completedGames.length > 0
    ? ((stats.wins / completedGames.length) * 100).toFixed(0)
    : null;

  return (
    <div className="px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={dim}>📊 My Stats</p>

      {stats.gamesPlayed === 0 ? (
        <p className="text-xs" style={dim}>No games played yet.</p>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[
              { label: "Games",  value: stats.gamesPlayed },
              { label: "Wins",   value: stats.wins,   color: "#4ade80" },
              { label: "Losses", value: stats.losses, color: "#f87171" },
              { label: "Win %",  value: pct ? `${pct}%` : "—" },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl border p-2.5 text-center"
                style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card2)" }}>
                <p className="text-lg font-bold" style={{ color: color ?? "var(--sh-text)" }}>{value}</p>
                <p className="text-xs mt-0.5" style={dim}>{label}</p>
              </div>
            ))}
          </div>

          {/* Positions */}
          {topPositions.length > 0 && (
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <span className="text-xs" style={dim}>Positions:</span>
              {topPositions.map(([pos, cnt]) => (
                <span key={pos} className="text-xs font-semibold rounded-full px-2.5 py-0.5"
                  style={{ background: "var(--sh-bg-card2)", color: "var(--sh-primary)", border: "1px solid var(--sh-border2)" }}>
                  {pos} <span style={dim}>×{cnt}</span>
                </span>
              ))}
            </div>
          )}

          {/* Recent games */}
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={dim}>Recent games</p>
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--sh-border)" }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: "var(--sh-bg-card2)", borderBottom: "1px solid var(--sh-border)" }}>
                  {["Date", "Opponent", "Pos", "#", "Score", "Result"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-semibold uppercase tracking-wider" style={dim}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.recentGames.slice(0, 8).map((g) => {
                  const rs = resultStyle(g.result);
                  return (
                    <tr key={g.gameId} style={{ borderBottom: "1px solid var(--sh-border)" }}>
                      <td className="px-3 py-2 whitespace-nowrap" style={dim}>
                        {new Date(g.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </td>
                      <td className="px-3 py-2 font-medium" style={head}>
                        <Link href={`/league/${slug}/season/${g.seasonId}`}
                          className="hover:underline">{g.opponentName}</Link>
                      </td>
                      <td className="px-3 py-2 font-semibold" style={{ color: "var(--sh-primary)" }}>{g.position}</td>
                      <td className="px-3 py-2" style={dim}>{g.battingOrder ?? "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap" style={head}>
                        {g.teamScore !== null && g.opponentScore !== null
                          ? `${g.teamScore} – ${g.opponentScore}`
                          : g.status === "IN_PROGRESS" ? "Live" : "—"}
                      </td>
                      <td className="px-3 py-2">
                        {g.result ? (
                          <span className="font-bold rounded-full px-2 py-0.5"
                            style={{ background: rs.bg, color: rs.color }}>{g.result}</span>
                        ) : (
                          <span style={dim}>{g.status === "IN_PROGRESS" ? "●" : "—"}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
