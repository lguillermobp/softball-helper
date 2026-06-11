"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export interface ScheduleGame {
  id: string;
  scheduledAt: string;
  startedAt: string | null;
  status: string;
  isPractice: boolean;
  homeScore: number | null;
  awayScore: number | null;
  homeTeam: { id: string; name: string; logoUrl: string | null };
  awayTeam: { id: string; name: string; logoUrl: string | null };
  league: { id: string; name: string; slug: string };
  season: { id: string; name: string };
  category: string | null;
  field: string | null;
  roleLabel: string;
  myTeamIsHome: boolean | null;
  scorekeeper: string | null;
  defaultGameDurationMins: number | null;
}

export interface StatRow {
  leagueName: string;
  leagueSlug: string;
  seasonName: string;
  ab: number; h: number; singles: number; doubles: number; triples: number; hr: number;
  ba: string;
}

interface Props {
  games: ScheduleGame[];
  stats: StatRow[];
  hasPlayingRole: boolean;
}

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  SCHEDULED:   { label: "Scheduled",   color: "#93c5fd", bg: "#1e3a5f" },
  IN_PROGRESS: { label: "Live",        color: "#4ade80", bg: "#14532d" },
  COMPLETED:   { label: "Final",       color: "#9ca3af", bg: "#1f2937" },
  CANCELLED:   { label: "Cancelled",   color: "#f87171", bg: "#450a0a" },
};

function TeamLogo({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoUrl} alt={name} className="w-7 h-7 rounded-full object-cover shrink-0" style={{ border: "1px solid var(--sh-border2)" }} />;
  }
  return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
      style={{ background: "var(--sh-bg-card2)", color: "var(--sh-primary)", border: "1px solid var(--sh-border2)" }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function GameCard({ game, now }: { game: ScheduleGame; now: Date }) {
  const st      = STATUS_STYLE[game.status] ?? STATUS_STYLE.SCHEDULED;
  const date    = new Date(game.scheduledAt);
  const isPast  = game.status === "COMPLETED" || game.status === "CANCELLED";
  const isLive  = game.status === "IN_PROGRESS";
  const myTeam  = game.myTeamIsHome === true ? game.homeTeam : game.myTeamIsHome === false ? game.awayTeam : null;
  const oppTeam = game.myTeamIsHome === true ? game.awayTeam : game.myTeamIsHome === false ? game.homeTeam : null;
  const href    = `/league/${game.league.slug}/season/${game.season.id}/game/${game.id}`;

  return (
    <Link href={href} className="block group">
    <div className="rounded-2xl border p-4 space-y-3 transition-all group-hover:shadow-md group-hover:scale-[1.005]"
      style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" }}>
      {/* Meta row */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold px-2 py-0.5 rounded-full border"
            style={{ color: "var(--sh-primary)", borderColor: "var(--sh-border2)", background: "var(--sh-bg-card2)" }}>
            {game.league.name}
          </span>
          <span className="text-xs" style={{ color: "var(--sh-muted)" }}>{game.season.name}</span>
          {game.category && <span className="text-xs" style={{ color: "var(--sh-muted)" }}>· {game.category}</span>}
          {game.isPractice && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ color: "#a78bfa", background: "#1a1a3d" }}>
              Practice
            </span>
          )}
        </div>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ color: st.color, background: st.bg }}>
          {st.label}
        </span>
      </div>

      {/* Teams */}
      {myTeam && oppTeam ? (
        // Simplified "my team vs opponent" view
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <TeamLogo name={myTeam.name} logoUrl={myTeam.logoUrl} />
            <span className="font-semibold text-sm truncate" style={{ color: "var(--sh-text)" }}>{myTeam.name}</span>
            <span className="text-xs shrink-0" style={{ color: "var(--sh-muted)" }}>{game.myTeamIsHome ? "🏠" : "✈️"}</span>
          </div>
          <span className="text-xs font-bold shrink-0" style={{ color: "var(--sh-muted)" }}>vs</span>
          <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
            <span className="font-semibold text-sm truncate text-right" style={{ color: "var(--sh-text)" }}>{oppTeam.name}</span>
            <TeamLogo name={oppTeam.name} logoUrl={oppTeam.logoUrl} />
          </div>
          {isPast && game.homeScore !== null && (
            <div className="shrink-0 text-sm font-bold tabular-nums" style={{ color: "var(--sh-primary)" }}>
              {game.myTeamIsHome ? game.homeScore : game.awayScore}–{game.myTeamIsHome ? game.awayScore : game.homeScore}
            </div>
          )}
        </div>
      ) : (
        // Official view: home vs away
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <TeamLogo name={game.homeTeam.name} logoUrl={game.homeTeam.logoUrl} />
            <span className="font-semibold text-sm truncate" style={{ color: "var(--sh-text)" }}>{game.homeTeam.name}</span>
          </div>
          {isPast && game.homeScore !== null
            ? <span className="text-sm font-bold tabular-nums shrink-0" style={{ color: "var(--sh-primary)" }}>{game.homeScore}–{game.awayScore}</span>
            : <span className="text-xs font-bold shrink-0" style={{ color: "var(--sh-muted)" }}>vs</span>}
          <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
            <span className="font-semibold text-sm truncate text-right" style={{ color: "var(--sh-text)" }}>{game.awayTeam.name}</span>
            <TeamLogo name={game.awayTeam.name} logoUrl={game.awayTeam.logoUrl} />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs" style={{ color: "var(--sh-muted)" }}>
            {date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
            {" · "}
            {date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
          </span>
          {game.field && <span className="text-xs" style={{ color: "var(--sh-muted)" }}>📍 {game.field}</span>}
          {game.scorekeeper && <span className="text-xs" style={{ color: "var(--sh-muted)" }}>📋 {game.scorekeeper}</span>}
        </div>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full border"
          style={{ color: "var(--sh-secondary)", borderColor: "var(--sh-border2)", background: "var(--sh-bg-card2)" }}>
          {game.roleLabel}
        </span>
      </div>
      {isLive && game.defaultGameDurationMins && (() => {
        const startedAt = new Date(game.startedAt ?? game.scheduledAt);
        const endAt = new Date(startedAt.getTime() + game.defaultGameDurationMins * 60_000);
        const remainMs = endAt.getTime() - now.getTime();
        const remainMins = Math.max(0, Math.floor(remainMs / 60_000));
        const isOvertime = remainMs < 0;
        return (
          <div className="flex items-center gap-4 flex-wrap text-xs pt-2 border-t"
            style={{ borderColor: "var(--sh-border)", color: "var(--sh-muted)" }}>
            <span>▶ {startedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            <span>⏹ {endAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            <span style={{ color: isOvertime || remainMins <= 10 ? "var(--sh-danger)" : "var(--sh-muted)" }}>
              {isOvertime ? "Overtime" : `${remainMins}min left`}
            </span>
          </div>
        );
      })()}
    </div>
    </Link>
  );
}

export function DashboardSchedule({ games, stats, hasPlayingRole }: Props) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const upcoming = games.filter(g => new Date(g.scheduledAt) >= now || g.status === "IN_PROGRESS");
  const past     = games.filter(g => new Date(g.scheduledAt) < now  && g.status !== "IN_PROGRESS" && g.status !== "SCHEDULED")
    .slice(-5);

  if (games.length === 0) {
    return (
      <div className="text-center py-16 rounded-2xl border" style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" }}>
        <div className="text-4xl mb-3">📅</div>
        <p className="text-sm font-semibold mb-1" style={{ color: "var(--sh-text)" }}>No games scheduled</p>
        <p className="text-xs" style={{ color: "var(--sh-muted)" }}>Games will appear here once your team or league is set up.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--sh-primary)" }}>
            Upcoming · {upcoming.length} game{upcoming.length !== 1 ? "s" : ""}
          </h3>
          {upcoming.map(g => <GameCard key={g.id} game={g} now={now} />)}
        </div>
      )}

      {/* Past */}
      {past.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--sh-muted)" }}>
            Last {past.length} game{past.length !== 1 ? "s" : ""}
          </h3>
          {[...past].reverse().map(g => <GameCard key={g.id} game={g} now={now} />)}
        </div>
      )}

      {/* Stats */}
      {hasPlayingRole && stats.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--sh-primary)" }}>
            My Stats
          </h3>
          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--sh-border)", background: "var(--sh-bg-card2)" }}>
                  {["League", "Season", "AB", "H", "2B", "3B", "HR", "BA"].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--sh-muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.map((s, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--sh-border)" }}>
                    <td className="px-3 py-2">
                      <Link href={`/league/${s.leagueSlug}`} className="text-xs font-semibold hover:underline" style={{ color: "var(--sh-primary)" }}>
                        {s.leagueName}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-xs" style={{ color: "var(--sh-muted)" }}>{s.seasonName}</td>
                    <td className="px-3 py-2 text-xs font-mono" style={{ color: "var(--sh-text)" }}>{s.ab}</td>
                    <td className="px-3 py-2 text-xs font-mono" style={{ color: "var(--sh-text)" }}>{s.h}</td>
                    <td className="px-3 py-2 text-xs font-mono" style={{ color: "var(--sh-text)" }}>{s.doubles}</td>
                    <td className="px-3 py-2 text-xs font-mono" style={{ color: "var(--sh-text)" }}>{s.triples}</td>
                    <td className="px-3 py-2 text-xs font-mono" style={{ color: "var(--sh-text)" }}>{s.hr}</td>
                    <td className="px-3 py-2 text-xs font-mono font-bold" style={{ color: "var(--sh-primary)" }}>{s.ba}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
