"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/context/language-context";
import { EditGameDialog } from "@/components/league/EditGameDialog";
import { AddGameDialog } from "@/components/league/AddGameDialog";
import { RescheduleGameDialog } from "@/components/league/RescheduleGameDialog";
import { TeamAvatar } from "@/components/ui/TeamAvatar";

interface Team { id: string; name: string; group: string | null }
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
  homeTeam: { id: string; name: string; logoUrl?: string | null };
  awayTeam: { id: string; name: string; logoUrl?: string | null };
  category: { id: string; name: string } | null;
  field: Field | null;
  rescheduledFromId: string | null;
  rescheduledFrom: { id: string; scheduledAt: string } | null;
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

type Tab = "schedule" | "standings" | "groups" | "hitting" | "pitching";

export function SeasonDashboard({
  slug, seasonId, seasonName, startDate, endDate, seasonStatus,
  isAdmin, games, teams, categories, fields, standings,
}: Props) {
  const router = useRouter();
  const { t } = useLanguage();
  const ts = t.season;
  const tg = ts.groups;

  const [tab, setTab] = useState<Tab>("schedule");
  const [gameError, setGameError] = useState<Record<string, string>>({});

  // Per-team group editing state
  const [groupValues, setGroupValues] = useState<Record<string, string>>(
    () => Object.fromEntries(teams.map((t) => [t.id, t.group ?? ""]))
  );
  const [groupSaving, setGroupSaving] = useState<Record<string, boolean>>({});
  const [groupSaved,  setGroupSaved]  = useState<Record<string, boolean>>({});
  const [groupError,  setGroupError]  = useState<Record<string, string>>({});

  const card = { borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" };
  const dim  = { color: "var(--sh-muted)" };

  function getStatusText(status: string) {
    if (status === "COMPLETED")   return "Final";
    if (status === "IN_PROGRESS") return "Live";
    if (status === "CANCELLED")   return "Cancelled";
    if (status === "RESCHEDULED") return ts.schedule.rescheduledBadge;
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

  async function saveGroup(teamId: string) {
    setGroupSaving((p) => ({ ...p, [teamId]: true }));
    setGroupError((p)  => ({ ...p, [teamId]: "" }));
    setGroupSaved((p)  => ({ ...p, [teamId]: false }));

    const res = await fetch(`/api/leagues/${slug}/teams/${teamId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ group: groupValues[teamId].trim().toUpperCase() || null }),
    });

    setGroupSaving((p) => ({ ...p, [teamId]: false }));
    if (res.ok) {
      setGroupSaved((p) => ({ ...p, [teamId]: true }));
      router.refresh();
      setTimeout(() => setGroupSaved((p) => ({ ...p, [teamId]: false })), 2000);
    } else {
      const data = await res.json();
      setGroupError((p) => ({ ...p, [teamId]: data.error ?? tg.error }));
    }
  }

  const tabs: { key: Tab; label: string; adminOnly?: boolean }[] = [
    { key: "schedule",  label: ts.tabs.schedule },
    { key: "standings", label: ts.tabs.standings },
    { key: "groups",    label: ts.tabs.groups, adminOnly: true },
    { key: "hitting",   label: ts.tabs.hitting },
    { key: "pitching",  label: ts.tabs.pitching },
  ];

  const visibleTabs = tabs.filter((tb) => !tb.adminOnly || isAdmin);

  const sb = getSeasonStatusText(seasonStatus);

  // Group standings logic
  const hasGroups = standings.some((s) => s.team.group);
  const groupKeys = hasGroups
    ? [...new Set(standings.map((s) => s.team.group ?? ""))].sort()
    : [];

  function StandingsTable({ rows }: { rows: Standing[] }) {
    return (
      <div className="rounded-2xl border overflow-hidden" style={card}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--sh-border)" }}>
              {[ts.standings.rank, ts.standings.team, ts.standings.gp, ts.standings.w, ts.standings.l, ts.standings.t, ts.standings.pts, ts.standings.rf, ts.standings.ra, ts.standings.pct].map((h) => (
                <th key={h} className="px-3 py-3 text-xs font-semibold uppercase tracking-wider text-center first:text-left" style={dim}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((s, i) => (
              <tr key={s.team.id} style={{ borderBottom: "1px solid var(--sh-border)" }}>
                <td className="px-3 py-3 text-center font-bold" style={{ color: i === 0 ? "var(--sh-warn)" : "var(--sh-muted)" }}>{i + 1}</td>
                <td className="px-3 py-3 font-semibold">
                  <div className="flex items-center gap-2">
                    <TeamAvatar name={s.team.name} logoUrl={(s.team as any).logoUrl} size={6} />
                    <span style={{ color: "var(--sh-text)" }}>{s.team.name}</span>
                  </div>
                </td>
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
    );
  }

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
          <AddGameDialog slug={slug} seasonId={seasonId} teams={teams} categories={categories} fields={fields} />
        )}
      </div>

      {/* ── Tab bar ── */}
      <div className="flex gap-1 rounded-xl p-1" style={{ background: "var(--sh-bg-card)", border: "1px solid var(--sh-border)" }}>
        {visibleTabs.map((tb) => (
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
            <div className="rounded-2xl border py-16 text-center text-sm" style={{ ...card, color: "var(--sh-primary)" }}>
              {ts.schedule.none}{isAdmin && ts.schedule.noneAdmin}
            </div>
          ) : (
            <div className="space-y-3">
              {games.map((game) => {
                const badge = {
                  bg:    game.status === "COMPLETED"   ? "var(--sh-approved-bg)"
                       : game.status === "IN_PROGRESS" ? "var(--sh-warn-bg)"
                       : game.status === "CANCELLED"   ? "var(--sh-danger-bg)"
                       : game.status === "RESCHEDULED" ? "var(--sh-purple-bg)"
                       : "var(--sh-info-bg)",
                  color: game.status === "COMPLETED"   ? "var(--sh-primary)"
                       : game.status === "IN_PROGRESS" ? "var(--sh-warn)"
                       : game.status === "CANCELLED"   ? "var(--sh-danger)"
                       : game.status === "RESCHEDULED" ? "var(--sh-purple)"
                       : "var(--sh-info)",
                  text:  getStatusText(game.status),
                };
                const homeGroup = teams.find((t) => t.id === game.homeTeamId)?.group;
                const awayGroup = teams.find((t) => t.id === game.awayTeamId)?.group;
                const gameGroup = homeGroup && homeGroup === awayGroup ? homeGroup : null;
                const date = new Date(game.scheduledAt);
                return (
                  <div key={game.id} className="rounded-xl border p-4" style={card}>
                    {gameError[game.id] && (
                      <p className="text-xs mb-2" style={{ color: "var(--sh-danger)" }}>{gameError[game.id]}</p>
                    )}
                    <div className="flex items-center justify-between gap-4">
                      {/* Teams & score */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="text-right flex-1 flex items-center justify-end gap-2">
                          <div>
                            <p className="font-bold truncate" style={{ color: "var(--sh-text)" }}>{game.homeTeam.name}</p>
                            <p className="text-xs" style={{ color: game.homeAwayTbd ? "var(--sh-warn)" : "var(--sh-primary)" }}>
                              {game.homeAwayTbd ? ts.schedule.tbd : ts.schedule.home}
                            </p>
                          </div>
                          <TeamAvatar name={game.homeTeam.name} logoUrl={game.homeTeam.logoUrl} size={8} />
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
                        <div className="flex-1 flex items-center gap-2">
                          <TeamAvatar name={game.awayTeam.name} logoUrl={game.awayTeam.logoUrl} size={8} />
                          <div>
                            <p className="font-bold truncate" style={{ color: "var(--sh-text)" }}>{game.awayTeam.name}</p>
                            <p className="text-xs" style={{ color: game.homeAwayTbd ? "var(--sh-warn)" : "var(--sh-primary)" }}>
                              {game.homeAwayTbd ? ts.schedule.tbd : ts.schedule.away}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Meta + actions */}
                      <div className="text-right shrink-0 space-y-1">
                        <div className="flex items-center gap-2 justify-end flex-wrap">
                          {gameGroup && (
                            <span
                              className="text-xs font-semibold rounded-full px-2 py-0.5"
                              style={{ background: "var(--sh-info-bg)", color: "var(--sh-info)" }}
                            >
                              {tg.groupStandings} {gameGroup}
                            </span>
                          )}
                          <span
                            className="text-xs font-semibold rounded-full px-2.5 py-0.5"
                            style={{ background: badge.bg, color: badge.color }}
                          >
                            {badge.text}
                          </span>
                          {isAdmin && game.status === "SCHEDULED" && (
                            <>
                              <EditGameDialog slug={slug} game={game} teams={teams} categories={categories} fields={fields} />
                              <RescheduleGameDialog slug={slug} game={game} teams={teams} categories={categories} fields={fields} />
                              <button
                                onClick={() => deleteGame(game.id)}
                                className="text-xs px-2 py-1 rounded-md border hover:opacity-80"
                                style={{ borderColor: "var(--sh-danger-border)", color: "var(--sh-danger)", background: "transparent" }}
                              >
                                {ts.schedule.delete}
                              </button>
                            </>
                          )}
                          {(game.status === "SCHEDULED" || game.status === "IN_PROGRESS") && (
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
                        {game.field    && <p className="text-xs" style={{ color: "var(--sh-primary)" }}>🏟️ {game.field.name}</p>}
                        {game.category && <p className="text-xs" style={{ color: "var(--sh-info)" }}>{game.category.name}</p>}
                        {game.rescheduledFrom && (
                          <p className="text-xs" style={{ color: "var(--sh-purple)" }}>
                            ↺ {ts.schedule.replacesGame}{" "}
                            {new Date(game.rescheduledFrom.scheduledAt).toLocaleDateString()}
                          </p>
                        )}
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
        <div className="space-y-6">
          {standings.length === 0 ? (
            <div className="rounded-2xl border py-16 text-center text-sm" style={{ ...card, color: "var(--sh-primary)" }}>
              {ts.standings.none}
            </div>
          ) : hasGroups ? (
            // Per-group standings
            groupKeys.map((g) => {
              const rows = standings.filter((s) => (s.team.group ?? "") === g);
              const label = g ? `${tg.groupStandings} ${g}` : tg.ungrouped;
              return (
                <div key={g} className="space-y-2">
                  <h3 className="text-sm font-bold uppercase tracking-widest" style={{ color: "var(--sh-primary)" }}>
                    {label}
                  </h3>
                  <StandingsTable rows={rows} />
                </div>
              );
            })
          ) : (
            <StandingsTable rows={standings} />
          )}
        </div>
      )}

      {/* ── Groups (admin only) ── */}
      {tab === "groups" && isAdmin && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold" style={{ color: "var(--sh-text)" }}>{tg.title}</h2>
            <p className="text-sm mt-1" style={{ color: "var(--sh-muted)" }}>{tg.hint}</p>
          </div>

          {teams.length === 0 ? (
            <div className="rounded-2xl border py-14 text-center text-sm" style={{ ...card, color: "var(--sh-primary)" }}>
              {tg.none}
            </div>
          ) : (
            <div className="space-y-2">
              {teams.map((team) => (
                <div
                  key={team.id}
                  className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3"
                  style={card}
                >
                  <span className="font-semibold text-sm" style={{ color: "var(--sh-text)" }}>{team.name}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {groupValues[team.id] && (
                      <span
                        className="text-xs font-bold rounded-full px-2.5 py-0.5"
                        style={{ background: "var(--sh-info-bg)", color: "var(--sh-info)" }}
                      >
                        {tg.groupStandings} {groupValues[team.id].toUpperCase()}
                      </span>
                    )}
                    <input
                      type="text"
                      maxLength={4}
                      value={groupValues[team.id]}
                      onChange={(e) => setGroupValues((p) => ({ ...p, [team.id]: e.target.value.toUpperCase() }))}
                      placeholder={tg.placeholder}
                      className="w-16 rounded-md border px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-green-500"
                      style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card2)", color: "var(--sh-text)" }}
                      onKeyDown={(e) => { if (e.key === "Enter") saveGroup(team.id); }}
                    />
                    <button
                      onClick={() => saveGroup(team.id)}
                      disabled={groupSaving[team.id]}
                      className="text-xs px-3 py-1.5 rounded-md border font-semibold transition-colors hover:opacity-80 disabled:opacity-40"
                      style={
                        groupSaved[team.id]
                          ? { borderColor: "var(--sh-primary)", color: "var(--sh-primary)", background: "var(--sh-approved-bg)" }
                          : { borderColor: "var(--sh-border2)", color: "var(--sh-secondary)", background: "transparent" }
                      }
                    >
                      {groupSaving[team.id] ? tg.saving : groupSaved[team.id] ? tg.saved : tg.save}
                    </button>
                    {groupError[team.id] && (
                      <span className="text-xs" style={{ color: "var(--sh-danger)" }}>{groupError[team.id]}</span>
                    )}
                  </div>
                </div>
              ))}
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
