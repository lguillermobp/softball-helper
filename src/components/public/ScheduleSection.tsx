"use client";

import { useState } from "react";

export interface UpcomingGame {
  id: string; scheduledAt: string;
  homeTeam: string; awayTeam: string;
  homeLogoUrl: string | null; awayLogoUrl: string | null;
  fieldName: string | null;
}

export interface PastGame {
  id: string; scheduledAt: string;
  homeTeam: string; awayTeam: string;
  homeLogoUrl: string | null; awayLogoUrl: string | null;
  homeScore: number; awayScore: number;
  fieldName: string | null;
}

const DAYS   = ["SUN","MON","TUE","WED","THU","FRI","SAT"] as const;
const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"] as const;

function Logo({ name, logoUrl, size = 30 }: { name: string; logoUrl: string | null; size?: number }) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoUrl} alt={name} style={{ width: size, height: size, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />;
  }
  return (
    <div style={{ width: size, height: size, borderRadius: 6, background: "#14532d", display: "flex", alignItems: "center", justifyContent: "center", color: "#4ade80", fontWeight: 700, fontSize: Math.round(size * 0.43), flexShrink: 0 }}>
      {name.charAt(0)}
    </div>
  );
}

function DateBlock({ iso }: { iso: string }) {
  const d = new Date(iso);
  return (
    <div style={{ padding: "12px 14px", background: "#111c11", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minWidth: 64, flexShrink: 0, gap: 2 }}>
      <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#4ade80" }}>{DAYS[d.getDay()]}</span>
      <span style={{ fontSize: 22, fontWeight: 800, color: "#f0fdf4", lineHeight: 1 }}>{d.getDate()}</span>
      <span style={{ fontSize: 10, textTransform: "uppercase", color: "#86efac" }}>{MONTHS[d.getMonth()]}</span>
    </div>
  );
}

function UpcomingCard({ game, showField }: { game: UpcomingGame; showField: boolean }) {
  const time = new Date(game.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <div style={{ display: "flex", alignItems: "stretch", borderRadius: 12, border: "1px solid #1a3a1a", background: "#0d1a0d", overflow: "hidden" }}>
      <DateBlock iso={game.scheduledAt} />
      {/* Matchup */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "12px 16px", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, justifyContent: "flex-end", overflow: "hidden" }}>
          <span style={{ color: "#f0fdf4", fontWeight: 600, fontSize: 14, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{game.homeTeam}</span>
          <Logo name={game.homeTeam} logoUrl={game.homeLogoUrl} />
        </div>
        <span style={{ fontSize: 10, fontWeight: 800, color: "#4ade80", letterSpacing: "0.1em", flexShrink: 0, padding: "0 4px" }}>VS</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, overflow: "hidden" }}>
          <Logo name={game.awayTeam} logoUrl={game.awayLogoUrl} />
          <span style={{ color: "#f0fdf4", fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{game.awayTeam}</span>
        </div>
      </div>
      {/* Time (+ field when not grouped) */}
      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "center", flexShrink: 0, gap: 3, minWidth: 70 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#86efac" }}>{time}</span>
        {showField && game.fieldName && (
          <span style={{ fontSize: 11, color: "#4ade80", opacity: 0.65, maxWidth: 110, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            📍 {game.fieldName}
          </span>
        )}
      </div>
    </div>
  );
}

function ResultCard({ game }: { game: PastGame }) {
  const homeWon = game.homeScore > game.awayScore;
  const awayWon = game.awayScore > game.homeScore;
  return (
    <div style={{ display: "flex", alignItems: "stretch", borderRadius: 12, border: "1px solid #1a3a1a", background: "#0d1a0d", overflow: "hidden" }}>
      <DateBlock iso={game.scheduledAt} />
      {/* Matchup + score */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "12px 16px", minWidth: 0 }}>
        {/* Home */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, justifyContent: "flex-end", overflow: "hidden" }}>
          <span style={{ color: homeWon ? "#f0fdf4" : "#4b5563", fontWeight: homeWon ? 700 : 400, fontSize: 14, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {game.homeTeam}
          </span>
          <Logo name={game.homeTeam} logoUrl={game.homeLogoUrl} />
        </div>
        {/* Score pill */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, padding: "5px 14px", borderRadius: 8, background: "#111c11", border: "1px solid #1a3a1a" }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: homeWon ? "#f0fdf4" : "#4b5563", minWidth: 22, textAlign: "center" }}>{game.homeScore}</span>
          <span style={{ fontSize: 11, color: "#4ade80", fontWeight: 700 }}>–</span>
          <span style={{ fontSize: 20, fontWeight: 800, color: awayWon ? "#f0fdf4" : "#4b5563", minWidth: 22, textAlign: "center" }}>{game.awayScore}</span>
        </div>
        {/* Away */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, overflow: "hidden" }}>
          <Logo name={game.awayTeam} logoUrl={game.awayLogoUrl} />
          <span style={{ color: awayWon ? "#f0fdf4" : "#4b5563", fontWeight: awayWon ? 700 : 400, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {game.awayTeam}
          </span>
        </div>
      </div>
      {/* Field */}
      {game.fieldName && (
        <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "center", flexShrink: 0, minWidth: 70 }}>
          <span style={{ fontSize: 11, color: "#4ade80", opacity: 0.65, maxWidth: 110, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            📍 {game.fieldName}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function ScheduleSection({ upcoming, past }: { upcoming: UpcomingGame[]; past: PastGame[] }) {
  const [tab, setTab] = useState<"upcoming" | "results">("upcoming");

  // Group upcoming by field name; only show groups when ≥2 distinct fields
  const distinctFields = [...new Set(upcoming.map(g => g.fieldName).filter(Boolean))];
  const shouldGroup = distinctFields.length > 1;

  const byField = new Map<string, UpcomingGame[]>();
  if (shouldGroup) {
    for (const g of upcoming) {
      const key = g.fieldName ?? "";
      if (!byField.has(key)) byField.set(key, []);
      byField.get(key)!.push(g);
    }
  }
  const fieldGroups = [...byField.entries()].sort(([a], [b]) => {
    if (!a && b) return 1;
    if (a && !b) return -1;
    return a.localeCompare(b);
  });

  const tabBtn = (active: boolean): React.CSSProperties => ({
    padding: "7px 18px",
    borderRadius: 8,
    border: "1px solid",
    borderColor: active ? "#4ade80" : "#1a3a1a",
    background: active ? "rgba(74,222,128,0.1)" : "transparent",
    color: active ? "#4ade80" : "#86efac",
    fontWeight: active ? 700 : 400,
    fontSize: 14,
    cursor: "pointer",
  });

  return (
    <section>
      {/* Header + tab buttons */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#4ade80", margin: 0 }}>📅 Schedule</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={tabBtn(tab === "upcoming")} onClick={() => setTab("upcoming")}>
            Upcoming{upcoming.length > 0 ? ` (${upcoming.length})` : ""}
          </button>
          <button style={tabBtn(tab === "results")} onClick={() => setTab("results")}>
            Results{past.length > 0 ? ` (${past.length})` : ""}
          </button>
        </div>
      </div>

      {/* Upcoming tab */}
      {tab === "upcoming" && (
        upcoming.length === 0 ? (
          <p style={{ color: "#86efac", opacity: 0.6, fontSize: 14, margin: 0 }}>No upcoming games scheduled.</p>
        ) : shouldGroup ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {fieldGroups.map(([field, games]) => (
              <div key={field || "tbd"}>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#4ade80", margin: "0 0 10px", opacity: 0.8 }}>
                  📍 {field || "No field assigned"}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {games.map(g => <UpcomingCard key={g.id} game={g} showField={false} />)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {upcoming.map(g => <UpcomingCard key={g.id} game={g} showField />)}
          </div>
        )
      )}

      {/* Results tab */}
      {tab === "results" && (
        past.length === 0 ? (
          <p style={{ color: "#86efac", opacity: 0.6, fontSize: 14, margin: 0 }}>No results yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {past.map(g => <ResultCard key={g.id} game={g} />)}
          </div>
        )
      )}
    </section>
  );
}
