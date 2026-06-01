"use client";

import { useState, useRef, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type OffenseResult = "" | "OUT" | "K" | "1B" | "2B" | "3B" | "HR";
const OFFENSE_CYCLE: OffenseResult[] = ["", "OUT", "K", "1B", "2B", "3B", "HR"];

interface ScoreBookData {
  offense: Record<string, Record<string, OffenseResult>>; // [inning][battingOrder]
  defense: Record<string, { outs: number; k: number }>;   // [inning]
}

interface BatterRow {
  playerId:     string;
  battingOrder: number;
  name:         string;
  jerseyNumber: string | null;
}

interface Props {
  slug:       string;
  gameId:     string;
  teamId:     string;
  teamName:   string;
  lineup:     BatterRow[];
  canEdit:    boolean;
  initialData: ScoreBookData | null;
}

const DEFAULT_INNINGS = 7;

const RESULT_STYLE: Record<OffenseResult, { bg: string; color: string; label: string }> = {
  "":    { bg: "transparent",  color: "var(--sh-muted)",    label: "—"  },
  "OUT": { bg: "#450a0a",      color: "#f87171",            label: "OUT" },
  "K":   { bg: "#451a03",      color: "#fbbf24",            label: "K"  },
  "1B":  { bg: "#14532d",      color: "#4ade80",            label: "1B" },
  "2B":  { bg: "#1e3a5f",      color: "#93c5fd",            label: "2B" },
  "3B":  { bg: "#1a1a3d",      color: "#a78bfa",            label: "3B" },
  "HR":  { bg: "#78350f",      color: "#fcd34d",            label: "HR" },
};

function emptyData(innings: number): ScoreBookData {
  const offense: ScoreBookData["offense"] = {};
  const defense: ScoreBookData["defense"] = {};
  for (let i = 1; i <= innings; i++) {
    offense[i] = {};
    defense[i] = { outs: 0, k: 0 };
  }
  return { offense, defense };
}

function mergeWithEmpty(data: ScoreBookData | null, innings: number): ScoreBookData {
  const base = emptyData(innings);
  if (!data) return base;
  return {
    offense: { ...base.offense, ...data.offense },
    defense: { ...base.defense, ...data.defense },
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ManagerScorebook({ slug, gameId, teamId, teamName, lineup, canEdit, initialData }: Props) {
  const [innings, setInnings] = useState(DEFAULT_INNINGS);
  const [data,    setData]    = useState<ScoreBookData>(() => mergeWithEmpty(initialData, DEFAULT_INNINGS));
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(async (next: ScoreBookData) => {
    setSaveState("saving");
    try {
      const res = await fetch(`/api/leagues/${slug}/games/${gameId}/scorebook`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, data: next }),
      });
      setSaveState(res.ok ? "saved" : "error");
      if (res.ok) setTimeout(() => setSaveState("idle"), 2000);
    } catch {
      setSaveState("error");
    }
  }, [slug, gameId, teamId]);

  function scheduleAutosave(next: ScoreBookData) {
    if (!canEdit) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(next), 1200);
  }

  function cycleOffense(inning: number, order: number) {
    if (!canEdit) return;
    setData(prev => {
      const cur = (prev.offense[inning]?.[order] ?? "") as OffenseResult;
      const idx = OFFENSE_CYCLE.indexOf(cur);
      const next: OffenseResult = OFFENSE_CYCLE[(idx + 1) % OFFENSE_CYCLE.length];
      const updated: ScoreBookData = {
        ...prev,
        offense: {
          ...prev.offense,
          [inning]: { ...prev.offense[inning], [order]: next },
        },
      };
      scheduleAutosave(updated);
      return updated;
    });
  }

  function cycleDefenseK(inning: number) {
    if (!canEdit) return;
    setData(prev => {
      const cur = prev.defense[inning]?.k ?? 0;
      const updated: ScoreBookData = {
        ...prev,
        defense: { ...prev.defense, [inning]: { ...prev.defense[inning], k: (cur + 1) % 10 } },
      };
      scheduleAutosave(updated);
      return updated;
    });
  }

  function addInning() {
    const next = innings + 1;
    setInnings(next);
    setData(prev => ({
      offense: { ...prev.offense, [next]: {} },
      defense: { ...prev.defense, [next]: { outs: 0, k: 0 } },
    }));
  }

  const inningNums = Array.from({ length: innings }, (_, i) => i + 1);

  // Per-inning offensive totals
  function inningTotals(inning: number) {
    const cells = Object.values(data.offense[inning] ?? {}) as OffenseResult[];
    const hits = cells.filter(r => r === "1B" || r === "2B" || r === "3B" || r === "HR").length;
    const outs = cells.filter(r => r === "OUT" || r === "K").length;
    const k    = cells.filter(r => r === "K").length;
    return { hits, outs, k };
  }

  const col   = "w-14 shrink-0 text-center";
  const cell  = "w-14 h-9 shrink-0 text-center text-xs font-bold rounded flex items-center justify-center";
  const hdr   = { color: "var(--sh-muted)", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.05em" };
  const card  = { borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-base" style={{ color: "var(--sh-text)" }}>📓 {teamName} — Manager's Scorebook</h3>
            <span className="text-xs font-semibold rounded-full px-2 py-0.5" style={{ background: "var(--sh-bg-card2)", color: "var(--sh-warn)", border: "1px solid var(--sh-border2)" }}>
              Unofficial
            </span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: "var(--sh-muted)" }}>
            {canEdit
              ? "Manager's own record — independent from the official league scoring. Auto-saves."
              : "Manager's own record — independent from the official league scoring."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saveState === "saving" && <span className="text-xs" style={{ color: "var(--sh-muted)" }}>Saving…</span>}
          {saveState === "saved"  && <span className="text-xs" style={{ color: "var(--sh-primary)" }}>✓ Saved</span>}
          {saveState === "error"  && <span className="text-xs" style={{ color: "#f87171" }}>Save failed</span>}
          {canEdit && (
            <button onClick={addInning}
              className="text-xs px-3 py-1.5 rounded-lg border"
              style={{ borderColor: "var(--sh-border2)", color: "var(--sh-primary)", background: "transparent" }}>
              + Inning
            </button>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {OFFENSE_CYCLE.slice(1).map(r => {
          const s = RESULT_STYLE[r];
          return (
            <span key={r} className="text-xs font-bold rounded px-2 py-0.5" style={{ background: s.bg, color: s.color }}>
              {s.label}
            </span>
          );
        })}
      </div>

      {/* ── Offense ── */}
      <div className="rounded-2xl border overflow-hidden" style={card}>
        <div className="px-4 py-2 border-b flex items-center gap-2" style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card2)" }}>
          <span style={{ ...hdr, color: "var(--sh-primary)" }}>⚔️ OFFENSE</span>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-max p-3 space-y-1">
            {/* Inning header */}
            <div className="flex items-center gap-1">
              <div className="w-36 shrink-0" />
              {inningNums.map(i => (
                <div key={i} className={col} style={hdr}>Inn {i}</div>
              ))}
            </div>

            {/* Batter rows */}
            {lineup.map(batter => (
              <div key={batter.playerId} className="flex items-center gap-1">
                <div className="w-36 shrink-0 flex items-center gap-1.5 pr-2">
                  <span className="text-xs font-bold w-5 text-right shrink-0" style={{ color: "var(--sh-primary)" }}>
                    {batter.jerseyNumber ? `#${batter.jerseyNumber}` : `${batter.battingOrder}`}
                  </span>
                  <span className="text-xs truncate" style={{ color: "var(--sh-text)" }}>{batter.name}</span>
                </div>
                {inningNums.map(inning => {
                  const result = (data.offense[inning]?.[batter.battingOrder] ?? "") as OffenseResult;
                  const s = RESULT_STYLE[result];
                  return (
                    <button
                      key={inning}
                      onClick={() => cycleOffense(inning, batter.battingOrder)}
                      disabled={!canEdit}
                      className={cell}
                      style={{ background: s.bg, color: s.color, border: "1px solid var(--sh-border)", cursor: canEdit ? "pointer" : "default" }}
                      title={canEdit ? "Tap to cycle result" : undefined}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            ))}

            {/* Totals row */}
            <div className="flex items-center gap-1 pt-2" style={{ borderTop: "1px solid var(--sh-border)" }}>
              <div className="w-36 shrink-0 text-right pr-2">
                <span style={{ ...hdr, color: "var(--sh-muted)" }}>H / O</span>
              </div>
              {inningNums.map(inning => {
                const t = inningTotals(inning);
                return (
                  <div key={inning} className={col} style={{ fontSize: "11px", color: "var(--sh-muted)", lineHeight: 1.4 }}>
                    <span style={{ color: "#4ade80" }}>{t.hits}H</span>
                    <br />
                    <span style={{ color: "#f87171" }}>{t.outs}O</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Defense ── */}
      <div className="rounded-2xl border overflow-hidden" style={card}>
        <div className="px-4 py-2 border-b flex items-center gap-2" style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card2)" }}>
          <span style={{ ...hdr, color: "#93c5fd" }}>🛡️ DEFENSE (allowed)</span>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-max p-3 space-y-1">
            {/* Inning header */}
            <div className="flex items-center gap-1">
              <div className="w-36 shrink-0" />
              {inningNums.map(i => (
                <div key={i} className={col} style={hdr}>Inn {i}</div>
              ))}
            </div>

            {/* Strikeouts row */}
            <div className="flex items-center gap-1">
              <div className="w-36 shrink-0 text-right pr-2">
                <span style={hdr}>Strikeouts</span>
              </div>
              {inningNums.map(inning => {
                const val = data.defense[inning]?.k ?? 0;
                return (
                  <button key={inning}
                    onClick={() => cycleDefenseK(inning)}
                    disabled={!canEdit}
                    className={cell}
                    style={{
                      background: val > 0 ? "#451a03" : "transparent",
                      color: val > 0 ? "#fbbf24" : "var(--sh-muted)",
                      border: "1px solid var(--sh-border)",
                      cursor: canEdit ? "pointer" : "default",
                    }}>
                    {val}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
