"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/context/language-context";
import { EditGameDialog } from "@/components/league/EditGameDialog";
import { AddGameDialog } from "@/components/league/AddGameDialog";

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
  seasonName: string;
  startDate: string;
  endDate: string;
  seasonStatus: string;
  isAdmin: boolean;
  games: Game[];
  teams: Team[];
  categories: Category[];
  fields: Field[];
  standings: Standing[];
}

type Tab = "schedule" | "standings" | "hitting" | "pitching";

export function SeasonDashboard({
  slug, seasonId, seasonName, startDate, endDate, seasonStatus,
  isAdmin, games, teams, categories, fields, standings,
}: Props) {
  const router = useRouter();
  const { t } = useLanguage();
  const ts = t.season;

  const [tab, setTab] = useState<Tab>("schedule");
  const [gameError, setGameError] = useState<Record<string, string>>({});

  const card = { borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" };
  const dim  = { color: "var(--sh-muted)" };

  function statusBadge(status: string) {
    if (status === "COMPLETED")   return { bg: "var(--sh-approved-bg)", color: "var(--sh-primary)", text: ts.schedule.home === "Home" ? "Final" : ts.tabs.standings };
    if (status === "IN_PROGRESS") return { bg: "var(--sh-warn-bg)",     color: "var(--sh-warn)",    text: "Live" };
    if (status === "CANCELLED")   return { bg: "var(--sh-danger-bg)",   color: "var(--sh-danger)",  text: "Cancelled" };
    return { bg: "var(--sh-info-bg)", color: "var(--sh-info)", text: ts.tabs.schedule };
  }

  // Properly mapped status badge text using translations
  function getStatusText(status: string) {
    if (status === "COMPLETED")   return "Final";
    if (status === "IN_PROGRESS") return "Live";
    if (status === "CANCELLED")   return "Cancelled";
    return ts.tabs.schedule;
  }

  function getSeasonStatusText(s: string) {
    if (s === "ACTIVE")    return { color: "var(--sh-primary)", text: ts.status.active };
    if (s === "COMPLETED") return { color: "var(--sh-muted)",   text: ts.status.completed };
    return { color: "var(--sh-warn)", text: ts.status.upcoming };
  }

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
    { key: "schedule",  label: ts.tabs.schedule },
    { key: "standings", label: ts.tabs.standings },
    { key: "hitting",   label: ts.tabs.hitting },
    { key: "pitching",  label: ts.tabs.pitching },
  ];

  const sb = getSeasonStatusText(seasonStatus);

  return (
    <div className="space-y-6">
      {/* ── Season info row ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--sh-text)" }}>{seasonName}</h1>
          <p className="text-sm mt-1" style={{ color: "var(--sh-primary)" }}>
            {new Date(startDate).toLocaleDateString()} – {new Date(endDate).toLocaleDateString()}
            {" · "}
            <span style={{ color: sb.color }}>{sb.text}</span>
          </p>
        </div>
        {isAdmin && (
          <AddGameDialog
            slug={slug}
            seasonId={seasonId}
            teams={teams}
            categories={categories}
            fields={fields}
          />
        )}
      </div>

      {/* ── Tab bar ── */}
      <div
        className="flex gap-1 rounded-xl p-1"
        style={{ background: "var(--sh-bg-card)", border: "1px solid var(--sh-border)" }}
      >
        {tabs.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
            style={
              tab === tb.key
                ? { background: "var(--sh-primary-dark)", color: "#fff" }
                : { color: "var(--sh-primary)", background: "transparent" }
            }
          >
            {tb.label}
          </button>
        ))}
      </div>

      {/* ── Schedule ── */}
      {tab === "schedule" && (
        <div>
          {games.length === 0 ? (
            <div
              className="rounded-2xl border py-16 text-center text-sm"
              style={{ ...card, color: "var(--sh-primary)" }}
            >
              {ts.schedule.none}
              {isAdmin && ts.schedule.noneAdmin}
            </div>
          ) : (
            <div className="space-y-3">
              {games.map((game) => {
                const badge = {
                  bg:    game.status === "COMPLETED"   ? "var(--sh-approved-bg)"
                       : game.status === "IN_PROGRESS" ? "var(--sh-warn-bg)"
                       : game.status === "CANCELLED"   ? "var(--sh-danger-bg)"
                       : "var(--sh-info-bg)",
                  color: game.status === "COMPLETED"   ? "var(--sh-primary)"
                       : game.status === "IN_PROGRESS" ? "var(--sh-warn)"
                       : game.status === "CANCELLED"   ? "var(--sh-danger)"
                       : "var(--sh-info)",
                  text:  getStatusText(game.status),
                };
                const date = new Date(game.scheduledAt);
                return (
                  <div key={game.id} className="rounded-xl border p-4" style={card}>
                    {gameError[game.id] && (
                      <p className="text-xs mb-2" style={{ color: "var(--sh-danger)" }}>{gameError[game.id]}</p>
                    )}
                    <div className="flex items-center justify-between gap-4">
                      {/* Teams & score */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="text-right flex-1">
                          <p className="font-bold truncate" style={{ color: "var(--sh-text)" }}>{game.homeTeam.name}</p>
                          <p className="text-xs" style={{ color: game.homeAwayTbd ? "var(--sh-warn)" : "var(--sh-primary)" }}>
                            {game.homeAwayTbd ? ts.schedule.tbd : ts.schedule.home}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {game.status === "COMPLETED" ? (
                            <span className="text-xl font-bold" style={{ color: "var(--sh-primary)" }}>
                              {game.homeScore ?? 0} – {game.awayScore ?? 0}
                            </span>
                          ) : (
                            <span className="text-sm font-semibold" style={dim}>vs</span>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-bold truncate" style={{ color: "var(--sh-text)" }}>{game.awayTeam.name}</p>
                          <p className="text-xs" style={{ color: game.homeAwayTbd ? "var(--sh-warn)" : "var(--sh-primary)" }}>
                            {game.homeAwayTbd ? ts.schedule.tbd : ts.schedule.away}
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
                                style={{ borderColor: "var(--sh-danger-border)", color: "var(--sh-danger)", background: "transparent" }}
                              >
                                {ts.schedule.delete}
                              </button>
                            </>
                          )}
                          {(isAdmin || true) && (game.status === "SCHEDULED" || game.status === "IN_PROGRESS") && (
                            <Link
                              href={`/league/${slug}/season/${seasonId}/game/${game.id}`}
                              className="text-xs font-semibold px-3 py-1 rounded-lg transition-all hover:opacity-80"
                              style={{ background: "var(--sh-bg-card2)", color: "var(--sh-primary)", border: "1px solid var(--sh-border2)" }}
                            >
                              {ts.schedule.scoring}
                            </Link>
                          )}
                        </div>
                        <p className="text-xs" style={dim}>
                          {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                        {game.field && <p className="text-xs" style={{ color: "var(--sh-primary)" }}>🏟️ {game.field.name}</p>}
                        {game.category && <p className="text-xs" style={{ color: "var(--sh-info)" }}>{game.category.name}</p>}
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
              style={{ ...card, color: "var(--sh-primary)" }}
            >
              {ts.standings.none}
            </div>
          ) : (
            <div className="rounded-2xl border overflow-hidden" style={card}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--sh-border)" }}>
                    {[ts.standings.rank, ts.standings.team, ts.standings.gp, ts.standings.w, ts.standings.l, ts.standings.t, ts.standings.pts, ts.standings.rf, ts.standings.ra, ts.standings.pct].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-3 text-xs font-semibold uppercase tracking-wider text-center first:text-left"
                        style={dim}
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
                      style={{ borderBottom: "1px solid var(--sh-border)" }}
                    >
                      <td className="px-3 py-3 text-center font-bold" style={{ color: i === 0 ? "var(--sh-warn)" : "var(--sh-muted)" }}>
                        {i + 1}
                      </td>
                      <td className="px-3 py-3 font-semibold" style={{ color: "var(--sh-text)" }}>{s.team.name}</td>
                      <td className="px-3 py-3 text-center" style={dim}>{s.gp}</td>
                      <td className="px-3 py-3 text-center font-bold" style={{ color: "var(--sh-primary)" }}>{s.w}</td>
                      <td className="px-3 py-3 text-center" style={{ color: "var(--sh-danger)" }}>{s.l}</td>
                      <td className="px-3 py-3 text-center" style={dim}>{s.t}</td>
                      <td className="px-3 py-3 text-center font-bold" style={{ color: "var(--sh-text)" }}>{s.pts}</td>
                      <td className="px-3 py-3 text-center" style={dim}>{s.rf}</td>
                      <td className="px-3 py-3 text-center" style={dim}>{s.ra}</td>
                      <td className="px-3 py-3 text-center" style={{ color: "var(--sh-secondary)" }}>{s.pct}</td>
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
        <div className="rounded-2xl border py-16 text-center" style={card}>
          <p className="text-2xl mb-3">🏏</p>
          <p className="font-semibold mb-1" style={{ color: "var(--sh-text)" }}>{ts.stats.hittingTitle}</p>
          <p className="text-sm" style={{ color: "var(--sh-primary)" }}>{ts.stats.hittingDesc}</p>
        </div>
      )}

      {/* ── Pitching Stats ── */}
      {tab === "pitching" && (
        <div className="rounded-2xl border py-16 text-center" style={card}>
          <p className="text-2xl mb-3">⚾</p>
          <p className="font-semibold mb-1" style={{ color: "var(--sh-text)" }}>{ts.stats.pitchingTitle}</p>
          <p className="text-sm" style={{ color: "var(--sh-primary)" }}>{ts.stats.pitchingDesc}</p>
        </div>
      )}
    </div>
  );
}
