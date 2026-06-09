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

// ── Types ──────────────────────────────────────────────────────────────────────

interface FieldGroup  { field: string | null; games: UpcomingGame[] }
interface DayGroup    { dayKey: string; label: string; total: number; fieldGroups: FieldGroup[] }

// ── Helpers ────────────────────────────────────────────────────────────────────

const SDOW   = ["SUN","MON","TUE","WED","THU","FRI","SAT"] as const;
const SMON   = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"] as const;
const FDOW   = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"] as const;
const FMON   = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"] as const;

function buildDayGroups(games: UpcomingGame[]): DayGroup[] {
  const dayMap = new Map<string, UpcomingGame[]>();
  for (const g of games) {
    const d = new Date(g.scheduledAt);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    if (!dayMap.has(key)) dayMap.set(key, []);
    dayMap.get(key)!.push(g);
  }

  return [...dayMap.keys()].sort().map(dayKey => {
    const dayGames = dayMap.get(dayKey)!;

    // Group by field within this day
    const fMap = new Map<string, UpcomingGame[]>();
    for (const g of dayGames) {
      const fk = g.fieldName ?? "";
      if (!fMap.has(fk)) fMap.set(fk, []);
      fMap.get(fk)!.push(g);
    }
    const fieldGroups: FieldGroup[] = [...fMap.entries()]
      .sort(([a], [b]) => (!a && b ? 1 : a && !b ? -1 : a.localeCompare(b)))
      .map(([fk, gs]) => ({ field: fk || null, games: gs }));

    // Day label: "Monday · Jun 9"
    const [y, mo, d] = dayKey.split("-").map(Number);
    const date = new Date(y, mo - 1, d, 12); // noon avoids DST edge
    const label = `${FDOW[date.getDay()]} · ${FMON[date.getMonth()]} ${d}`;

    return { dayKey, label, total: dayGames.length, fieldGroups };
  });
}

// ── Sub-components ─────────────────────────────────────────────────────────────

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

// Full date block — used in standalone upcoming cards
function DateBlock({ iso }: { iso: string }) {
  const d = new Date(iso);
  return (
    <div style={{ padding: "12px 14px", background: "#111c11", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minWidth: 64, flexShrink: 0, gap: 2 }}>
      <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#4ade80" }}>{SDOW[d.getDay()]}</span>
      <span style={{ fontSize: 22, fontWeight: 800, color: "#f0fdf4", lineHeight: 1 }}>{d.getDate()}</span>
      <span style={{ fontSize: 10, textTransform: "uppercase", color: "#86efac" }}>{SMON[d.getMonth()]}</span>
    </div>
  );
}

// Date + time block — used in ResultCard
function DateTimeBlock({ iso }: { iso: string }) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <div style={{ padding: "12px 14px", background: "#111c11", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minWidth: 64, flexShrink: 0, gap: 2 }}>
      <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#4ade80" }}>{SDOW[d.getDay()]}</span>
      <span style={{ fontSize: 20, fontWeight: 800, color: "#f0fdf4", lineHeight: 1 }}>{d.getDate()}</span>
      <span style={{ fontSize: 10, textTransform: "uppercase", color: "#86efac" }}>{SMON[d.getMonth()]}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: "#86efac", marginTop: 3 }}>{time}</span>
    </div>
  );
}

// Time-only block — used inside day groups (date already shown in header)
function TimeBlock({ iso }: { iso: string }) {
  const time = new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <div style={{ padding: "0 16px", background: "#111c11", display: "flex", alignItems: "center", justifyContent: "center", minWidth: 64, flexShrink: 0 }}>
      <span style={{ fontSize: 14, fontWeight: 700, color: "#86efac" }}>{time}</span>
    </div>
  );
}

function Matchup({ game }: { game: UpcomingGame }) {
  return (
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
  );
}

// Card inside a day group — time block on left, no redundant date
function GroupedUpcomingCard({ game }: { game: UpcomingGame }) {
  return (
    <div style={{ display: "flex", alignItems: "stretch", borderRadius: 12, border: "1px solid #1a3a1a", background: "#0d1a0d", overflow: "hidden" }}>
      <TimeBlock iso={game.scheduledAt} />
      <Matchup game={game} />
    </div>
  );
}

// Standalone card (ungrouped fallback) — full date + time + optional field
function StandaloneUpcomingCard({ game }: { game: UpcomingGame }) {
  const time = new Date(game.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <div style={{ display: "flex", alignItems: "stretch", borderRadius: 12, border: "1px solid #1a3a1a", background: "#0d1a0d", overflow: "hidden" }}>
      <DateBlock iso={game.scheduledAt} />
      <Matchup game={game} />
      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "center", flexShrink: 0, gap: 3, minWidth: 70 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#86efac" }}>{time}</span>
        {game.fieldName && (
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
      <DateTimeBlock iso={game.scheduledAt} />
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "12px 16px", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, justifyContent: "flex-end", overflow: "hidden" }}>
          <span style={{ color: homeWon ? "#f0fdf4" : "#9ca3af", fontWeight: homeWon ? 700 : 400, fontSize: 14, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{game.homeTeam}</span>
          <Logo name={game.homeTeam} logoUrl={game.homeLogoUrl} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, padding: "5px 14px", borderRadius: 8, background: "#111c11", border: "1px solid #1a3a1a" }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: homeWon ? "#f0fdf4" : "#9ca3af", minWidth: 22, textAlign: "center" }}>{game.homeScore}</span>
          <span style={{ fontSize: 11, color: "#4ade80", fontWeight: 700 }}>–</span>
          <span style={{ fontSize: 20, fontWeight: 800, color: awayWon ? "#f0fdf4" : "#9ca3af", minWidth: 22, textAlign: "center" }}>{game.awayScore}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, overflow: "hidden" }}>
          <Logo name={game.awayTeam} logoUrl={game.awayLogoUrl} />
          <span style={{ color: awayWon ? "#f0fdf4" : "#9ca3af", fontWeight: awayWon ? 700 : 400, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{game.awayTeam}</span>
        </div>
      </div>
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

  const dayGroups = buildDayGroups(upcoming);

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
      {/* Header + tabs */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 8 }}>
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

      {/* ── Upcoming tab ── */}
      {tab === "upcoming" && (
        upcoming.length === 0 ? (
          <p style={{ color: "#86efac", opacity: 0.6, fontSize: 14, margin: 0 }}>No upcoming games scheduled.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {dayGroups.map(({ dayKey, label, total, fieldGroups }) => {
              const multiField = fieldGroups.length > 1;
              return (
                <div key={dayKey}>
                  {/* Day header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "#f0fdf4", whiteSpace: "nowrap" }}>{label}</span>
                    <span style={{ fontSize: 11, color: "#4ade80", fontWeight: 600, background: "rgba(74,222,128,0.1)", borderRadius: 20, padding: "2px 10px", whiteSpace: "nowrap" }}>
                      {total} game{total !== 1 ? "s" : ""}
                    </span>
                    <div style={{ flex: 1, height: 1, background: "#1a3a1a" }} />
                  </div>

                  {/* Field sub-groups (when ≥2 fields on this day) or flat list */}
                  {multiField ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                      {fieldGroups.map(({ field, games }) => (
                        <div key={field ?? "tbd"}>
                          <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#4ade80", margin: "0 0 8px", opacity: 0.75 }}>
                            📍 {field ?? "No field assigned"}
                          </p>
                          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                            {games.map(g => <GroupedUpcomingCard key={g.id} game={g} />)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                      {fieldGroups[0].games.map(g => <GroupedUpcomingCard key={g.id} game={g} />)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ── Results tab ── */}
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
