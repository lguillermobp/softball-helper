"use client";

import { useState, useRef, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type OffenseResult = "" | "OUT" | "K" | "DP" | "TP" | "BB" | "1B" | "2B" | "3B" | "HR";
const OFFENSE_CYCLE: OffenseResult[] = ["", "OUT", "K", "DP", "TP", "BB", "1B", "2B", "3B", "HR"];

// How many outs each result contributes to the inning total
const OUT_WEIGHT: Partial<Record<OffenseResult, number>> = { OUT: 1, K: 1, DP: 2, TP: 3 };

interface ScoreBookData {
  offense:    Record<string, Record<string, OffenseResult>>; // [inningKey][battingOrder]
  defense:    Record<string, { outs: number; k: number }>;   // [inningKey]
  runs:       Record<string, number>;                        // [inningKey] → this team's runs
  rivalRuns:  Record<string, number>;                        // [inningKey] → opponent's runs (manually entered)
}

interface BatterRow {
  playerId:     string;
  battingOrder: number;
  name:         string;
  jerseyNumber: string | null;
}

interface Props {
  slug:         string;
  gameId:       string;
  teamId:       string;
  teamName:     string;
  opponentName: string;
  lineup:       BatterRow[];
  canEdit:      boolean;
  isHome:       boolean;
  initialData:  ScoreBookData | null;
}

const DEFAULT_INNINGS = 7;

const RESULT_STYLE: Record<OffenseResult, { bg: string; color: string; label: string }> = {
  "":    { bg: "transparent", color: "var(--sh-muted)",  label: "—"   },
  "OUT": { bg: "#450a0a",     color: "#f87171",           label: "OUT" },
  "K":   { bg: "#451a03",     color: "#fbbf24",           label: "K"   },
  "1B":  { bg: "#14532d",     color: "#4ade80",           label: "1B"  },
  "2B":  { bg: "#1e3a5f",     color: "#93c5fd",           label: "2B"  },
  "3B":  { bg: "#1a1a3d",     color: "#a78bfa",           label: "3B"  },
  "HR":  { bg: "#78350f",     color: "#fcd34d",           label: "HR"  },
  "DP":  { bg: "#6b1a1a",     color: "#fca5a5",           label: "DP"  },
  "TP":  { bg: "#881337",     color: "#fda4af",           label: "TP"  },
  "BB":  { bg: "#164e63",     color: "#67e8f9",           label: "BB"  },
};

// ── Inning-key helpers ────────────────────────────────────────────────────────

function parseKey(key: string): { base: number; ext: string } {
  const m = key.match(/^(\d+)([a-z]*)$/);
  return m ? { base: parseInt(m[1]), ext: m[2] } : { base: 0, ext: "" };
}

function sortKeys(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    const pa = parseKey(a), pb = parseKey(b);
    return pa.base !== pb.base ? pa.base - pb.base : pa.ext.localeCompare(pb.ext);
  });
}

function nextExtKey(keys: string[], baseKey: string): string {
  const { base } = parseKey(baseKey);
  const exts = keys.filter(k => parseKey(k).base === base).map(k => parseKey(k).ext);
  const maxExt = exts.reduce((m, e) => (e > m ? e : m), "");
  const nextExt = maxExt === "" ? "b" : String.fromCharCode(maxExt.charCodeAt(maxExt.length - 1) + 1);
  return String(base) + nextExt;
}

function defaultKeys(): string[] {
  return Array.from({ length: DEFAULT_INNINGS }, (_, i) => String(i + 1));
}

// ── Data helpers ──────────────────────────────────────────────────────────────

function emptyInning(): { offense: Record<string, OffenseResult>; defense: { outs: number; k: number }; runs: number } {
  return { offense: {}, defense: { outs: 0, k: 0 }, runs: 0 };
}

function mergeWithDefaults(data: ScoreBookData | null): { data: ScoreBookData; keys: string[] } {
  if (!data || !data.offense || Object.keys(data.offense).length === 0) {
    const keys = defaultKeys();
    const offense: ScoreBookData["offense"] = {};
    const defense: ScoreBookData["defense"] = {};
    const runs: ScoreBookData["runs"]       = {};
    const rivalRuns: ScoreBookData["rivalRuns"] = {};
    keys.forEach(k => { offense[k] = {}; defense[k] = { outs: 0, k: 0 }; runs[k] = 0; rivalRuns[k] = 0; });
    return { data: { offense, defense, runs, rivalRuns }, keys };
  }
  const keys = sortKeys(Object.keys(data.offense));
  return {
    data: {
      offense:   data.offense,
      defense:   data.defense   ?? {},
      runs:      data.runs      ?? {},
      rivalRuns: data.rivalRuns ?? {},
    },
    keys,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ManagerScorebook({
  slug, gameId, teamId, teamName, opponentName, lineup, canEdit, isHome, initialData,
}: Props) {
  const { data: initData, keys: initOffenseKeys } = mergeWithDefaults(initialData as ScoreBookData | null);
  const initBaseKeys = initOffenseKeys.filter(k => parseKey(k).ext === "");

  const [baseKeys,    setBaseKeys]    = useState<string[]>(initBaseKeys);
  const [offenseKeys, setOffenseKeys] = useState<string[]>(initOffenseKeys);
  const [data,       setData]       = useState<ScoreBookData>(initData);
  const [saveState,  setSaveState]  = useState<"idle" | "saving" | "saved" | "error">("idle");
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

  function cycleOffense(key: string, order: number) {
    if (!canEdit) return;
    setData(prev => {
      const cur = (prev.offense[key]?.[order] ?? "") as OffenseResult;
      const next: OffenseResult = OFFENSE_CYCLE[(OFFENSE_CYCLE.indexOf(cur) + 1) % OFFENSE_CYCLE.length];
      const updated: ScoreBookData = {
        ...prev,
        offense: { ...prev.offense, [key]: { ...prev.offense[key], [order]: next } },
      };
      scheduleAutosave(updated);
      return updated;
    });
  }

  function resetOffense(key: string, order: number) {
    if (!canEdit) return;
    setData(prev => {
      const updated: ScoreBookData = {
        ...prev,
        offense: { ...prev.offense, [key]: { ...prev.offense[key], [order]: "" } },
      };
      scheduleAutosave(updated);
      return updated;
    });
  }

  function cycleDefenseK(key: string) {
    if (!canEdit) return;
    setData(prev => {
      const updated: ScoreBookData = {
        ...prev,
        defense: { ...prev.defense, [key]: { ...prev.defense[key], k: ((prev.defense[key]?.k ?? 0) + 1) % 10 } },
      };
      scheduleAutosave(updated);
      return updated;
    });
  }

  function cycleRuns(key: string) {
    if (!canEdit) return;
    setData(prev => {
      const updated: ScoreBookData = { ...prev, runs: { ...prev.runs, [key]: ((prev.runs?.[key] ?? 0) + 1) % 16 } };
      scheduleAutosave(updated);
      return updated;
    });
  }

  function cycleRivalRuns(key: string) {
    if (!canEdit) return;
    setData(prev => {
      const updated: ScoreBookData = { ...prev, rivalRuns: { ...prev.rivalRuns, [key]: ((prev.rivalRuns?.[key] ?? 0) + 1) % 16 } };
      scheduleAutosave(updated);
      return updated;
    });
  }

  function resetRun(key: string) {
    if (!canEdit) return;
    setData(prev => {
      const updated: ScoreBookData = { ...prev, runs: { ...prev.runs, [key]: 0 } };
      scheduleAutosave(updated);
      return updated;
    });
  }

  function resetRivalRun(key: string) {
    if (!canEdit) return;
    setData(prev => {
      const updated: ScoreBookData = { ...prev, rivalRuns: { ...prev.rivalRuns, [key]: 0 } };
      scheduleAutosave(updated);
      return updated;
    });
  }

  function addInning() {
    if (!canEdit) return;
    const maxBase = baseKeys.reduce((m, k) => Math.max(m, parseKey(k).base), 0);
    const newKey = String(maxBase + 1);
    setBaseKeys(prev => [...prev, newKey]);
    setOffenseKeys(prev => [...prev, newKey]);
    setData(prev => ({
      offense:   { ...prev.offense,   [newKey]: {} },
      defense:   { ...prev.defense,   [newKey]: { outs: 0, k: 0 } },
      runs:      { ...prev.runs,      [newKey]: 0 },
      rivalRuns: { ...prev.rivalRuns, [newKey]: 0 },
    }));
  }

  function extendInning(key: string) {
    if (!canEdit) return;
    const newKey  = nextExtKey(offenseKeys, key);
    const base    = parseKey(key).base;
    const lastIdx = offenseKeys.reduce((idx, k, i) => parseKey(k).base === base ? i : idx, 0);
    setOffenseKeys(prev => [
      ...prev.slice(0, lastIdx + 1),
      newKey,
      ...prev.slice(lastIdx + 1),
    ]);
    setData(prev => ({
      ...prev,
      offense: { ...prev.offense, [newKey]: {} },
    }));
  }

  function inningTotals(key: string) {
    const cells = Object.values(data.offense[key] ?? {}) as OffenseResult[];
    return {
      hits: cells.filter(r => r === "1B" || r === "2B" || r === "3B" || r === "HR").length,
      outs: cells.reduce((sum, r) => sum + (OUT_WEIGHT[r] ?? 0), 0),
    };
  }

  // Visitor = away team; Home = home team
  function getVisitorRuns(key: string) { return isHome ? (data.rivalRuns?.[key] ?? 0) : (data.runs?.[key] ?? 0); }
  function getHomeRuns(key: string)    { return isHome ? (data.runs?.[key] ?? 0) : (data.rivalRuns?.[key] ?? 0); }
  const visitorName = isHome ? opponentName : teamName;
  const homeName    = isHome ? teamName     : opponentName;

  const col  = "w-14 shrink-0 text-center";
  const cell = "w-14 h-9 shrink-0 text-center text-xs font-bold rounded flex items-center justify-center";
  const hdr  = { color: "var(--sh-muted)", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.05em" };
  const card = { borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" };

  const totalVisitor = baseKeys.reduce((s, k) => s + getVisitorRuns(k), 0);
  const totalHome    = baseKeys.reduce((s, k) => s + getHomeRuns(k), 0);

  function isExtEmpty(key: string) {
    return Object.values(data.offense[key] ?? {}).every(v => !v);
  }

  function removeExtInning(key: string) {
    if (!canEdit) return;
    setOffenseKeys(prev => prev.filter(k => k !== key));
    setData(prev => {
      const offense = { ...prev.offense };
      delete offense[key];
      return { ...prev, offense };
    });
  }

  function InningHeaders({ keys, showExtend }: { keys: string[]; showExtend: boolean }) {
    return (
      <div className="flex items-center gap-1">
        <div className="w-36 shrink-0" />
        {keys.map(key => {
          const { base, ext } = parseKey(key);
          const isExt = ext !== "";
          const canRemove = isExt && canEdit && isExtEmpty(key);
          return (
            <div key={key} className="w-14 shrink-0 flex flex-col items-center" style={{ gap: 1 }}>
              <span
                onDoubleClick={canRemove ? (e) => { e.preventDefault(); removeExtInning(key); } : undefined}
                title={canRemove ? "Double-tap to remove this column" : undefined}
                style={{ ...hdr, color: isExt ? "#4ade80" : "var(--sh-muted)", cursor: canRemove ? "pointer" : "default" }}>
                {isExt ? `+${base}` : `Inn ${base}`}
              </span>
              {showExtend && canEdit && (
                <button
                  onClick={() => extendInning(key)}
                  title="Extend this inning (batter bats again)"
                  className="text-xs hover:opacity-70 leading-none"
                  style={{ color: "#4ade80", fontSize: 11 }}
                >
                  ⊕
                </button>
              )}
            </div>
          );
        })}
        <div className="w-14 shrink-0 text-center" style={hdr}>TOT</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
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
              ? "Manager's own record. Tap to cycle · double-tap to clear. Auto-saves."
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

      {/* ── Legend ── */}
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

      {/* ── Runs per Inning ── */}
      <div className="rounded-2xl border overflow-hidden" style={card}>
        <div className="px-4 py-2 border-b flex items-center justify-between gap-2 flex-wrap" style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card2)" }}>
          <div className="flex items-center gap-2">
            <span style={{ ...hdr, color: "#fbbf24" }}>🏃 RUNS PER INNING</span>
            {canEdit && <span className="text-xs normal-case font-normal" style={{ color: "var(--sh-muted)" }}>tap to add · double-tap to reset</span>}
          </div>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-max p-3 space-y-1">
            <InningHeaders keys={baseKeys} showExtend={false} />

            {/* Visitor row */}
            <div className="flex items-center gap-1">
              <div className="w-36 shrink-0 text-right pr-2">
                <span className="text-xs font-semibold truncate" style={{ color: "#93c5fd" }}>
                  🚌 {visitorName}
                </span>
              </div>
              {baseKeys.map(key => {
                const runs = getVisitorRuns(key);
                const onTap   = isHome ? cycleRivalRuns : cycleRuns;
                const onReset = isHome ? resetRivalRun  : resetRun;
                return (
                  <button key={key}
                    onClick={canEdit ? () => onTap(key) : undefined}
                    onDoubleClick={canEdit ? (e) => { e.preventDefault(); onReset(key); } : undefined}
                    disabled={!canEdit}
                    className={cell}
                    style={{
                      background: runs > 0 ? "#1e3a5f" : "transparent",
                      color: runs > 0 ? "#93c5fd" : "var(--sh-muted)",
                      border: "1px solid var(--sh-border)",
                      cursor: canEdit ? "pointer" : "default",
                    }}>
                    {runs}
                  </button>
                );
              })}
              <div className="w-14 shrink-0 text-center font-bold text-sm" style={{ color: "#93c5fd" }}>
                {totalVisitor}
              </div>
            </div>

            {/* Home row */}
            <div className="flex items-center gap-1">
              <div className="w-36 shrink-0 text-right pr-2">
                <span className="text-xs font-semibold truncate" style={{ color: "#4ade80" }}>
                  🏠 {homeName}
                </span>
              </div>
              {baseKeys.map(key => {
                const runs = getHomeRuns(key);
                const onTap   = isHome ? cycleRuns : cycleRivalRuns;
                const onReset = isHome ? resetRun  : resetRivalRun;
                return (
                  <button key={key}
                    onClick={canEdit ? () => onTap(key) : undefined}
                    onDoubleClick={canEdit ? (e) => { e.preventDefault(); onReset(key); } : undefined}
                    disabled={!canEdit}
                    className={cell}
                    style={{
                      background: runs > 0 ? "#14532d" : "transparent",
                      color: runs > 0 ? "#4ade80" : "var(--sh-muted)",
                      border: "1px solid var(--sh-border)",
                      cursor: canEdit ? "pointer" : "default",
                    }}>
                    {runs}
                  </button>
                );
              })}
              <div className="w-14 shrink-0 text-center font-bold text-sm" style={{ color: "#4ade80" }}>
                {totalHome}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Offense ── */}
      <div className="rounded-2xl border overflow-hidden" style={card}>
        <div className="px-4 py-2 border-b flex items-center gap-2" style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card2)" }}>
          <span style={{ ...hdr, color: "var(--sh-primary)" }}>⚔️ OFFENSE</span>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-max p-3 space-y-1">
            <InningHeaders keys={offenseKeys} showExtend={true} />

            {lineup.map(batter => (
              <div key={batter.playerId} className="flex items-center gap-1">
                <div className="w-36 shrink-0 flex items-center gap-1.5 pr-2">
                  <span className="text-xs font-bold w-5 text-right shrink-0" style={{ color: "var(--sh-primary)" }}>
                    {batter.jerseyNumber ? `#${batter.jerseyNumber}` : `${batter.battingOrder}`}
                  </span>
                  <span className="text-xs truncate" style={{ color: "var(--sh-text)" }}>{batter.name}</span>
                </div>
                {offenseKeys.map(key => {
                  const result = (data.offense[key]?.[batter.battingOrder] ?? "") as OffenseResult;
                  const s = RESULT_STYLE[result];
                  return (
                    <button key={key}
                      onClick={() => cycleOffense(key, batter.battingOrder)}
                      onDoubleClick={canEdit ? (e) => { e.preventDefault(); resetOffense(key, batter.battingOrder); } : undefined}
                      disabled={!canEdit}
                      className={cell}
                      style={{ background: s.bg, color: s.color, border: "1px solid var(--sh-border)", cursor: canEdit ? "pointer" : "default" }}
                      title={canEdit ? "Tap to cycle · double-tap to clear" : undefined}>
                      {s.label}
                    </button>
                  );
                })}
                {/* Totals column placeholder */}
                <div className="w-14 shrink-0" />
              </div>
            ))}

            {/* H / O totals row */}
            <div className="flex items-center gap-1 pt-2" style={{ borderTop: "1px solid var(--sh-border)" }}>
              <div className="w-36 shrink-0 text-right pr-2">
                <span style={{ ...hdr, color: "var(--sh-muted)" }}>H / O</span>
              </div>
              {offenseKeys.map(key => {
                const t = inningTotals(key);
                const overLimit = t.outs > 3;
                return (
                  <div key={key} className={col}
                    style={{
                      fontSize: "11px", lineHeight: 1.4,
                      borderRadius: "6px",
                      background: overLimit ? "#450a0a" : "transparent",
                      outline: overLimit ? "1px solid #f87171" : "none",
                    }}>
                    <span style={{ color: "#4ade80" }}>{t.hits}H</span>
                    <br />
                    <span style={{ color: overLimit ? "#fbbf24" : "#f87171", fontWeight: overLimit ? 900 : 700 }}>
                      {t.outs}O{overLimit ? "⚠" : ""}
                    </span>
                  </div>
                );
              })}
              <div className="w-14 shrink-0" />
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
            <InningHeaders keys={baseKeys} showExtend={false} />

            <div className="flex items-center gap-1">
              <div className="w-36 shrink-0 text-right pr-2">
                <span style={hdr}>Strikeouts</span>
              </div>
              {baseKeys.map(key => {
                const val = data.defense[key]?.k ?? 0;
                return (
                  <button key={key}
                    onClick={() => cycleDefenseK(key)}
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
              <div className="w-14 shrink-0" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
