"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EditGameDialog } from "@/components/league/EditGameDialog";

interface Team { id: string; name: string }
interface Category { id: string; name: string }
interface Field    { id: string; name: string }
interface Game {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  fieldId: string | null;
  categoryId: string | null;
  scheduledAt: string;
  homeAwayTbd: boolean;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  homeTeam: { id: string; name: string };
  awayTeam: { id: string; name: string };
  category: { id: string; name: string } | null;
  field: Field | null;
}

interface Standing {
  team: Team;
  gp: number;
  w: number;
  l: number;
  t: number;
  pts: number;
  rf: number;
  ra: number;
  pct: string;
}

interface Props {
  slug: string;
  seasonId: string;
  isAdmin: boolean;
  games: Game[];
  teams: Team[];
  categories: Category[];
  fields: Field[];
  standings: Standing[];
}

type Tab = "schedule" | "standings" | "hitting" | "pitching";

const cardStyle = { borderColor: "#1e3a1e", background: "#0f2310" };
const dimStyle = { color: "#6b7280" };

function statusBadge(status: string) {
  if (status === "COMPLETED")   return { bg: "#14532d", color: "#4ade80", text: "Final" };
  if (status === "IN_PROGRESS") return { bg: "#78350f", color: "#fbbf24", text: "Live" };
  if (status === "CANCELLED")   return { bg: "#3f1515", color: "#f87171", text: "Cancelled" };
  return { bg: "#1e3a5f", color: "#93c5fd", text: "Scheduled" };
}

export function SeasonDashboard({ slug, seasonId, isAdmin, games, teams, categories, fields, standings }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("schedule");
  const [gameError, setGameError] = useState<Record<string, string>>({});

  async function deleteGame(gameId: string) {
    setGameError({});
    const res = await fetch(`/api/leagues/${slug}/games/${gameId}`, { method: "DELETE" });
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json();
      setGameError((prev) => ({ ...prev, [gameId]: data.error ?? "Cannot delete" }));
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "schedule",  label: "Schedule" },
    { key: "standings", label: "Standings" },
    { key: "hitting",   label: "Hitting" },
    { key: "pitching",  label: "Pitching" },
  ];

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl p-1" style={{ background: "#0f2310", border: "1px solid #1e3a1e" }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
            style={
              tab === t.key
                ? { background: "#16a34a", color: "#fff" }
                : { color: "#4ade80", background: "transparent" }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Schedule ── */}
      {tab === "schedule" && (
        <div>
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
                  <div key={game.id} className="rounded-xl border p-4" style={cardStyle}>
                    {gameError[game.id] && (
                      <p className="text-xs mb-2" style={{ color: "#f87171" }}>{gameError[game.id]}</p>
                    )}
                    <div className="flex items-center justify-between gap-4">
                      {/* Teams & score */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="text-right flex-1">
                          <p className="font-bold truncate" style={{ color: "#f0fdf4" }}>{game.homeTeam.name}</p>
                          <p className="text-xs" style={{ color: game.homeAwayTbd ? "#fbbf24" : "#4ade80" }}>
                            {game.homeAwayTbd ? "TBD" : "Home"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {game.status === "COMPLETED" ? (
                            <span className="text-xl font-bold" style={{ color: "#4ade80" }}>
                              {game.homeScore ?? 0} – {game.awayScore ?? 0}
                            </span>
                          ) : (
                            <span className="text-sm font-semibold" style={dimStyle}>vs</span>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-bold truncate" style={{ color: "#f0fdf4" }}>{game.awayTeam.name}</p>
                          <p className="text-xs" style={{ color: game.homeAwayTbd ? "#fbbf24" : "#4ade80" }}>
                            {game.homeAwayTbd ? "TBD" : "Away"}
                          </p>
                        </div>
                      </div>

                      {/* Meta + actions */}
                      <div className="text-right shrink-0 space-y-1">
                        <div className="flex items-center gap-2 justify-end flex-wrap">
                          <span
                            className="text-xs font-semibold rounded-full px-2.5 py-0.5"
                            style={{ background: badge.bg, color: badge.color }}
                          >
                            {badge.text}
                          </span>
                          {isAdmin && game.status === "SCHEDULED" && (
                            <>
                              <EditGameDialog
                                slug={slug}
                                game={game}
                                teams={teams}
                                categories={categories}
                                fields={fields}
                              />
                              <button
                                onClick={() => deleteGame(game.id)}
                                className="text-xs px-2 py-1 rounded-md border hover:opacity-80"
                                style={{ borderColor: "#3f1515", color: "#f87171", background: "transparent" }}
                              >
                                Delete
                              </button>
                            </>
                          )}
                          {isAdmin && (game.status === "SCHEDULED" || game.status === "IN_PROGRESS") && (
                            <button
                              disabled
                              className="text-xs font-semibold px-3 py-1 rounded-lg opacity-60 cursor-not-allowed"
                              style={{ background: "#1a3d1a", color: "#4ade80", border: "1px solid #2d5a2d" }}
                              title="Scoring coming soon"
                            >
                              Score
                            </button>
                          )}
                        </div>
                        <p className="text-xs" style={dimStyle}>
                          {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                        {game.field && <p className="text-xs" style={{ color: "#4ade80" }}>🏟️ {game.field.name}</p>}
                        {game.category && <p className="text-xs" style={{ color: "#93c5fd" }}>{game.category.name}</p>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Standings ── */}
      {tab === "standings" && (
        <div>
          {standings.length === 0 ? (
            <div
              className="rounded-2xl border py-16 text-center text-sm"
              style={{ ...cardStyle, color: "#4ade80" }}
            >
              Standings will appear once games are completed.
            </div>
          ) : (
            <div className="rounded-2xl border overflow-hidden" style={cardStyle}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid #1e3a1e" }}>
                    {["#", "Team", "GP", "W", "L", "T", "Pts", "RF", "RA", "Pct"].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-3 text-xs font-semibold uppercase tracking-wider text-center first:text-left"
                        style={dimStyle}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {standings.map((s, i) => (
                    <tr
                      key={s.team.id}
                      style={{ borderBottom: "1px solid #0f2310" }}
                    >
                      <td className="px-3 py-3 text-center font-bold" style={{ color: i === 0 ? "#fbbf24" : "#6b7280" }}>
                        {i + 1}
                      </td>
                      <td className="px-3 py-3 font-semibold" style={{ color: "#f0fdf4" }}>{s.team.name}</td>
                      <td className="px-3 py-3 text-center" style={dimStyle}>{s.gp}</td>
                      <td className="px-3 py-3 text-center font-bold" style={{ color: "#4ade80" }}>{s.w}</td>
                      <td className="px-3 py-3 text-center" style={{ color: "#f87171" }}>{s.l}</td>
                      <td className="px-3 py-3 text-center" style={dimStyle}>{s.t}</td>
                      <td className="px-3 py-3 text-center font-bold" style={{ color: "#f0fdf4" }}>{s.pts}</td>
                      <td className="px-3 py-3 text-center" style={dimStyle}>{s.rf}</td>
                      <td className="px-3 py-3 text-center" style={dimStyle}>{s.ra}</td>
                      <td className="px-3 py-3 text-center" style={{ color: "#86efac" }}>{s.pct}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Hitting Stats ── */}
      {tab === "hitting" && (
        <div
          className="rounded-2xl border py-16 text-center"
          style={{ ...cardStyle }}
        >
          <p className="text-2xl mb-3">🏏</p>
          <p className="font-semibold mb-1" style={{ color: "#f0fdf4" }}>Hitting Stats</p>
          <p className="text-sm" style={{ color: "#4ade80" }}>
            Available once game scoring is enabled.
          </p>
        </div>
      )}

      {/* ── Pitching Stats ── */}
      {tab === "pitching" && (
        <div
          className="rounded-2xl border py-16 text-center"
          style={{ ...cardStyle }}
        >
          <p className="text-2xl mb-3">⚾</p>
          <p className="font-semibold mb-1" style={{ color: "#f0fdf4" }}>Pitching Stats</p>
          <p className="text-sm" style={{ color: "#4ade80" }}>
            Available once game scoring is enabled.
          </p>
        </div>
      )}
    </div>
  );
}
