"use client";

import { useState, useRef, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type OffenseResult = "" | "OUT" | "K" | "DP" | "TP" | "E" | "BB" | "1B" | "2B" | "3B" | "HR";
const OFFENSE_CYCLE: OffenseResult[] = ["", "OUT", "K", "DP", "TP", "E", "BB", "1B", "2B", "3B", "HR"];

const OUT_WEIGHT: Partial<Record<OffenseResult, number>> = { OUT: 1, K: 1, DP: 2, TP: 3 };

interface ScoreBookData {
  offense:    Record<string, Record<string, OffenseResult>>;
  defense:    Record<string, { outs: number; k: number }>;
  runs:       Record<string, number>;
  rivalRuns:  Record<string, number>;
}

interface BatterRow {
  playerId:     string;
  battingOrder: number;
  name:         string;
  jerseyNumber: string | null;
}

interface VoiceState {
  phase:     "idle" | "listening" | "recognized" | "error" | "no-inning" | "unsupported";
  batter:    BatterRow | null;
  inningKey: string | null;
  result:    OffenseResult | null;
  transcript: string;
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
  "E":   { bg: "#431407",     color: "#fb923c",           label: "E"   },
  "BB":  { bg: "#164e63",     color: "#67e8f9",           label: "BB"  },
};

// Spoken phrases → result code (sorted longest-first at runtime for greedy match)
const VOICE_MAP: [string, OffenseResult][] = [
  ["double play",   "DP"],
  ["triple play",   "TP"],
  ["base on balls", "BB"],
  ["home run",      "HR"],
  ["homerun",       "HR"],
  ["strikeout",     "K"],
  ["strike out",    "K"],
  ["single",        "1B"],
  ["double",        "2B"],
  ["triple",        "3B"],
  ["homer",         "HR"],
  ["error",         "E"],
  ["walk",          "BB"],
  ["out",           "OUT"],
  ["hr",            "HR"],
  ["bb",            "BB"],
  ["dp",            "DP"],
  ["tp",            "TP"],
  ["1b",            "1B"],
  ["2b",            "2B"],
  ["3b",            "3B"],
  ["k",             "K"],
  ["e",             "E"],
];

function parseVoiceResult(transcript: string): OffenseResult | null {
  const lower = transcript.toLowerCase().trim();
  for (const [phrase, result] of VOICE_MAP) {
    if (lower.includes(phrase)) return result;
  }
  return null;
}

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

function mergeWithDefaults(data: ScoreBookData | null): { data: ScoreBookData; keys: string[] } {
  if (!data || !data.offense || Object.keys(data.offense).length === 0) {
    const keys = defaultKeys();
    const offense: ScoreBookData["offense"]   = {};
    const defense: ScoreBookData["defense"]   = {};
    const runs: ScoreBookData["runs"]         = {};
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

const IDLE_VOICE: VoiceState = { phase: "idle", batter: null, inningKey: null, result: null, transcript: "" };

// ── Component ─────────────────────────────────────────────────────────────────

export function ManagerScorebook({
  slug, gameId, teamId, teamName, opponentName, lineup, canEdit, isHome, initialData,
}: Props) {
  const { data: initData, keys: initOffenseKeys } = mergeWithDefaults(initialData as ScoreBookData | null);
  const initBaseKeys = initOffenseKeys.filter(k => parseKey(k).ext === "");

  const [baseKeys,    setBaseKeys]    = useState<string[]>(initBaseKeys);
  const [offenseKeys, setOffenseKeys] = useState<string[]>(initOffenseKeys);
  const [data,        setData]        = useState<ScoreBookData>(initData);
  const [saveState,   setSaveState]   = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [voiceState,  setVoiceState]  = useState<VoiceState>(IDLE_VOICE);

  const saveTimer       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragResultRef   = useRef<OffenseResult | null>(null);
  const recognitionRef  = useRef<any>(null);
  const lpTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lpOriginRef     = useRef<{ x: number; y: number } | null>(null);

  const [dragTarget, setDragTarget] = useState<string | null>(null);

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

  // ── Offense helpers ───────────────────────────────────────────────────────

  function applyOffense(key: string, order: number, result: OffenseResult) {
    setData(prev => {
      const updated: ScoreBookData = {
        ...prev,
        offense: { ...prev.offense, [key]: { ...prev.offense[key], [order]: result } },
      };
      scheduleAutosave(updated);
      return updated;
    });
  }

  function cycleOffense(key: string, order: number) {
    if (!canEdit) return;
    setData(prev => {
      const cur  = (prev.offense[key]?.[order] ?? "") as OffenseResult;
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
    applyOffense(key, order, "");
  }

  // First inning key that has no result for this batter
  function firstEmptyInning(order: number): string | null {
    for (const key of offenseKeys) {
      if (!data.offense[key]?.[order]) return key;
    }
    return null;
  }

  // ── Voice input ───────────────────────────────────────────────────────────

  function cancelVoice() {
    if (recognitionRef.current) { recognitionRef.current.abort(); recognitionRef.current = null; }
    setVoiceState(IDLE_VOICE);
  }

  function startVoiceForBatter(batter: BatterRow) {
    if (!canEdit) return;

    const SR = typeof window !== "undefined"
      && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

    if (!SR) {
      setVoiceState({ phase: "unsupported", batter, inningKey: null, result: null, transcript: "" });
      return;
    }

    const inningKey = firstEmptyInning(batter.battingOrder);
    setVoiceState({ phase: "listening", batter, inningKey, result: null, transcript: "" });

    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 5;

    recognition.onresult = (event: any) => {
      const transcripts: string[] = Array.from(
        { length: event.results[0].length },
        (_: unknown, i: number) => event.results[0][i].transcript as string,
      );
      const combined = transcripts.join(" ");
      const result   = parseVoiceResult(combined);

      if (!result) {
        setVoiceState(prev => ({ ...prev, phase: "error", transcript: combined }));
        return;
      }
      if (!inningKey) {
        setVoiceState(prev => ({ ...prev, phase: "no-inning", result, transcript: combined }));
        return;
      }

      applyOffense(inningKey, batter.battingOrder, result);
      setVoiceState(prev => ({ ...prev, phase: "recognized", result, transcript: combined }));
      setTimeout(() => setVoiceState(v => v.phase === "recognized" ? IDLE_VOICE : v), 2000);
    };

    recognition.onerror = (event: any) => {
      const msg = event.error === "no-speech" ? "No speech detected" : event.error;
      setVoiceState(prev => ({ ...prev, phase: "error", transcript: msg }));
    };

    recognition.onend = () => {
      setVoiceState(prev => prev.phase === "listening"
        ? { ...prev, phase: "error", transcript: "No speech detected" }
        : prev,
      );
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  // ── Long-press handlers ───────────────────────────────────────────────────

  function lpDown(e: React.PointerEvent, batter: BatterRow) {
    if (!canEdit) return;
    lpOriginRef.current = { x: e.clientX, y: e.clientY };
    lpTimerRef.current  = setTimeout(() => startVoiceForBatter(batter), 600);
  }

  function lpCancel() {
    if (lpTimerRef.current)  { clearTimeout(lpTimerRef.current); lpTimerRef.current = null; }
    lpOriginRef.current = null;
  }

  function lpMove(e: React.PointerEvent) {
    if (!lpOriginRef.current) return;
    const dx = e.clientX - lpOriginRef.current.x;
    const dy = e.clientY - lpOriginRef.current.y;
    if (dx * dx + dy * dy > 100) lpCancel(); // >10px movement = scroll intent
  }

  // ── Other data mutations ──────────────────────────────────────────────────

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
    setData(prev => { const u: ScoreBookData = { ...prev, runs: { ...prev.runs, [key]: 0 } }; scheduleAutosave(u); return u; });
  }

  function resetRivalRun(key: string) {
    if (!canEdit) return;
    setData(prev => { const u: ScoreBookData = { ...prev, rivalRuns: { ...prev.rivalRuns, [key]: 0 } }; scheduleAutosave(u); return u; });
  }

  function addInning() {
    if (!canEdit) return;
    const maxBase = baseKeys.reduce((m, k) => Math.max(m, parseKey(k).base), 0);
    const newKey  = String(maxBase + 1);
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
    setOffenseKeys(prev => [...prev.slice(0, lastIdx + 1), newKey, ...prev.slice(lastIdx + 1)]);
    setData(prev => ({ ...prev, offense: { ...prev.offense, [newKey]: {} } }));
  }

  function inningTotals(key: string) {
    const cells = Object.values(data.offense[key] ?? {}) as OffenseResult[];
    return {
      hits: cells.filter(r => r === "1B" || r === "2B" || r === "3B" || r === "HR").length,
      outs: cells.reduce((sum, r) => sum + (OUT_WEIGHT[r] ?? 0), 0),
    };
  }

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

  // ── Layout helpers ────────────────────────────────────────────────────────

  function getVisitorRuns(key: string) { return isHome ? (data.rivalRuns?.[key] ?? 0) : (data.runs?.[key] ?? 0); }
  function getHomeRuns(key: string)    { return isHome ? (data.runs?.[key] ?? 0) : (data.rivalRuns?.[key] ?? 0); }
  const visitorName = isHome ? opponentName : teamName;
  const homeName    = isHome ? teamName     : opponentName;

  const col  = "w-16 shrink-0 text-center";
  const cell = "w-16 h-9 shrink-0 text-center text-xs font-bold rounded flex items-center justify-center";
  const hdr  = { color: "var(--sh-muted)", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.05em" };
  const card = { borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" };

  const totalVisitor = baseKeys.reduce((s, k) => s + getVisitorRuns(k), 0);
  const totalHome    = baseKeys.reduce((s, k) => s + getHomeRuns(k), 0);

  function InningHeaders({ keys, showExtend }: { keys: string[]; showExtend: boolean }) {
    return (
      <div className="flex items-center gap-1">
        <div className="w-36 shrink-0" />
        {keys.map(key => {
          const { base, ext } = parseKey(key);
          const isExt     = ext !== "";
          const canRemove = isExt && canEdit && isExtEmpty(key);
          return (
            <div key={key} className="w-16 shrink-0 flex flex-col items-center" style={{ gap: 1 }}>
              <span
                onDoubleClick={canRemove ? (e) => { e.preventDefault(); removeExtInning(key); } : undefined}
                title={canRemove ? "Double-tap to remove this column" : undefined}
                style={{ ...hdr, color: isExt ? "#4ade80" : "var(--sh-muted)", cursor: canRemove ? "pointer" : "default" }}>
                {isExt ? `+${base}` : `Inn ${base}`}
              </span>
              {showExtend && canEdit && (
                <button onClick={() => extendInning(key)} title="Extend this inning"
                  className="text-xs hover:opacity-70 leading-none" style={{ color: "#4ade80", fontSize: 11 }}>
                  ⊕
                </button>
              )}
            </div>
          );
        })}
        <div className="w-16 shrink-0 text-center" style={hdr}>TOT</div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      <style>{`@keyframes sb-pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.18);opacity:.65}}`}</style>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-base" style={{ color: "var(--sh-text)" }}>📓 {teamName} — Manager's Scorebook</h3>
            <span className="text-xs font-semibold rounded-full px-2 py-0.5"
              style={{ background: "var(--sh-bg-card2)", color: "var(--sh-warn)", border: "1px solid var(--sh-border2)" }}>
              Unofficial
            </span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: "var(--sh-muted)" }}>
            {canEdit
              ? "Tap to cycle · double-tap to clear · drag badge to set · long-press name for voice 🎤"
              : "Manager's own record — independent from the official league scoring."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saveState === "saving" && <span className="text-xs" style={{ color: "var(--sh-muted)" }}>Saving…</span>}
          {saveState === "saved"  && <span className="text-xs" style={{ color: "var(--sh-primary)" }}>✓ Saved</span>}
          {saveState === "error"  && <span className="text-xs" style={{ color: "#f87171" }}>Save failed</span>}
          {canEdit && (
            <button onClick={addInning} className="text-xs px-3 py-1.5 rounded-lg border"
              style={{ borderColor: "var(--sh-border2)", color: "var(--sh-primary)", background: "transparent" }}>
              + Inning
            </button>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="space-y-1.5">
        <div className="flex flex-wrap gap-2">
          {OFFENSE_CYCLE.slice(1).map(r => {
            const s = RESULT_STYLE[r];
            return (
              <span key={r}
                className="text-xs font-bold rounded px-2 py-0.5 select-none"
                draggable={canEdit}
                onDragStart={() => { dragResultRef.current = r; }}
                onDragEnd={() => { dragResultRef.current = null; setDragTarget(null); }}
                style={{ background: s.bg, color: s.color, cursor: canEdit ? "grab" : "default" }}
                title={canEdit ? `Drag onto a cell to set ${s.label}` : undefined}>
                {s.label}
              </span>
            );
          })}
        </div>
        {canEdit && (
          <p className="text-xs" style={{ color: "var(--sh-muted)" }}>
            Drag a badge onto any cell · or long-press a player name and speak
          </p>
        )}
      </div>

      {/* Runs per Inning */}
      <div className="rounded-2xl border overflow-hidden" style={card}>
        <div className="px-4 py-2 border-b flex items-center justify-between gap-2 flex-wrap"
          style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card2)" }}>
          <div className="flex items-center gap-2">
            <span style={{ ...hdr, color: "#fbbf24" }}>🏃 RUNS PER INNING</span>
            {canEdit && <span className="text-xs normal-case font-normal" style={{ color: "var(--sh-muted)" }}>tap to add · double-tap to reset</span>}
          </div>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-max p-3 space-y-1">
            <InningHeaders keys={baseKeys} showExtend={false} />

            {/* Visitor */}
            <div className="flex items-center gap-1">
              <div className="w-36 shrink-0 text-right pr-2">
                <span className="text-xs font-semibold truncate" style={{ color: "#93c5fd" }}>🚌 {visitorName}</span>
              </div>
              {baseKeys.map(key => {
                const runs    = getVisitorRuns(key);
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
              <div className="w-16 shrink-0 text-center font-bold text-sm" style={{ color: "#93c5fd" }}>{totalVisitor}</div>
            </div>

            {/* Home */}
            <div className="flex items-center gap-1">
              <div className="w-36 shrink-0 text-right pr-2">
                <span className="text-xs font-semibold truncate" style={{ color: "#4ade80" }}>🏠 {homeName}</span>
              </div>
              {baseKeys.map(key => {
                const runs    = getHomeRuns(key);
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
              <div className="w-16 shrink-0 text-center font-bold text-sm" style={{ color: "#4ade80" }}>{totalHome}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Offense */}
      <div className="rounded-2xl border overflow-hidden" style={card}>
        <div className="px-4 py-2 border-b flex items-center gap-2"
          style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card2)" }}>
          <span style={{ ...hdr, color: "var(--sh-primary)" }}>⚔️ OFFENSE</span>
          {canEdit && <span className="text-xs normal-case font-normal" style={{ color: "var(--sh-muted)" }}>long-press name 🎤</span>}
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-max p-3 space-y-1">
            <InningHeaders keys={offenseKeys} showExtend={true} />

            {lineup.map(batter => (
              <div key={batter.playerId} className="flex items-center gap-1">
                {/* Player name — long-press for voice */}
                <div
                  className="w-36 shrink-0 flex items-center gap-1.5 pr-2"
                  onPointerDown={canEdit ? (e) => lpDown(e, batter) : undefined}
                  onPointerUp={canEdit ? lpCancel : undefined}
                  onPointerLeave={canEdit ? lpCancel : undefined}
                  onPointerCancel={canEdit ? lpCancel : undefined}
                  onPointerMove={canEdit ? lpMove : undefined}
                  onContextMenu={canEdit ? (e) => e.preventDefault() : undefined}
                  style={{ cursor: canEdit ? "pointer" : "default", userSelect: "none", touchAction: "none" }}
                  title={canEdit ? "Long-press to use voice input" : undefined}
                >
                  <span className="text-xs font-bold w-5 text-right shrink-0" style={{ color: "var(--sh-primary)" }}>
                    {batter.jerseyNumber ? `#${batter.jerseyNumber}` : `${batter.battingOrder}`}
                  </span>
                  <span className="text-xs truncate" style={{ color: "var(--sh-text)" }}>{batter.name}</span>
                  {canEdit && <span className="text-xs shrink-0 opacity-30" style={{ marginLeft: "auto" }}>🎤</span>}
                </div>

                {/* Inning cells */}
                {offenseKeys.map(key => {
                  const result   = (data.offense[key]?.[batter.battingOrder] ?? "") as OffenseResult;
                  const s        = RESULT_STYLE[result];
                  const targetId = `${key}-${batter.battingOrder}`;
                  const isOver   = dragTarget === targetId;
                  return (
                    <button key={key}
                      onClick={() => cycleOffense(key, batter.battingOrder)}
                      onDoubleClick={canEdit ? (e) => { e.preventDefault(); resetOffense(key, batter.battingOrder); } : undefined}
                      onDragOver={canEdit ? (e) => { e.preventDefault(); setDragTarget(targetId); } : undefined}
                      onDragLeave={canEdit ? () => setDragTarget(null) : undefined}
                      onDrop={canEdit ? (e) => {
                        e.preventDefault();
                        const r = dragResultRef.current;
                        if (r !== null) applyOffense(key, batter.battingOrder, r);
                        setDragTarget(null);
                      } : undefined}
                      disabled={!canEdit}
                      className={cell}
                      style={{
                        background: isOver ? "rgba(74,222,128,0.15)" : s.bg,
                        color:      isOver ? "#4ade80" : s.color,
                        border:     isOver ? "2px solid #4ade80" : "1px solid var(--sh-border)",
                        cursor:     canEdit ? "pointer" : "default",
                      }}
                      title={canEdit ? "Tap to cycle · double-tap to clear · drop badge to set" : undefined}>
                      {isOver && dragResultRef.current ? RESULT_STYLE[dragResultRef.current].label : s.label}
                    </button>
                  );
                })}
                <div className="w-16 shrink-0" />
              </div>
            ))}

            {/* H / O totals */}
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
                      fontSize: "11px", lineHeight: 1.4, borderRadius: "6px",
                      background: overLimit ? "#450a0a" : "transparent",
                      outline:    overLimit ? "1px solid #f87171" : "none",
                    }}>
                    <span style={{ color: "#4ade80" }}>{t.hits}H</span>
                    <br />
                    <span style={{ color: overLimit ? "#fbbf24" : "#f87171", fontWeight: overLimit ? 900 : 700 }}>
                      {t.outs}O{overLimit ? "⚠" : ""}
                    </span>
                  </div>
                );
              })}
              <div className="w-16 shrink-0" />
            </div>
          </div>
        </div>
      </div>

      {/* Defense */}
      <div className="rounded-2xl border overflow-hidden" style={card}>
        <div className="px-4 py-2 border-b flex items-center gap-2"
          style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card2)" }}>
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
                      color:      val > 0 ? "#fbbf24" : "var(--sh-muted)",
                      border:     "1px solid var(--sh-border)",
                      cursor:     canEdit ? "pointer" : "default",
                    }}>
                    {val}
                  </button>
                );
              })}
              <div className="w-16 shrink-0" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Voice overlay ── */}
      {voiceState.phase !== "idle" && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.82)", backdropFilter: "blur(4px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) cancelVoice(); }}
        >
          <div style={{ background: "#0f2310", border: "1px solid #1e3a1e", borderRadius: 24, padding: "36px 28px", maxWidth: 340, width: "90%", textAlign: "center" }}>

            {voiceState.phase === "listening" && (
              <>
                <div style={{ fontSize: 52, marginBottom: 10, display: "inline-block", animation: "sb-pulse 1.1s ease-in-out infinite" }}>🎤</div>
                <p style={{ fontSize: 16, fontWeight: 700, color: "#f0fdf4", margin: "0 0 4px" }}>{voiceState.batter?.name}</p>
                <p style={{ fontSize: 12, color: "#4ade80", margin: "0 0 22px" }}>
                  {voiceState.inningKey
                    ? `→ Inning ${parseKey(voiceState.inningKey).base}`
                    : "All innings filled — clear a cell first"}
                </p>
                <p style={{ fontSize: 11, color: "#86efac", opacity: 0.65, margin: "0 0 12px" }}>Say a result:</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginBottom: 24 }}>
                  {OFFENSE_CYCLE.slice(1).map(r => {
                    const s = RESULT_STYLE[r];
                    return (
                      <span key={r} style={{ fontSize: 12, fontWeight: 700, background: s.bg, color: s.color, borderRadius: 6, padding: "4px 10px" }}>
                        {s.label}
                      </span>
                    );
                  })}
                </div>
                <p style={{ fontSize: 10, color: "#374151", margin: "0 0 16px" }}>
                  "home run" · "single" · "double" · "triple" · "out" · "walk" · "error" …
                </p>
                <button onClick={cancelVoice}
                  style={{ fontSize: 13, padding: "9px 28px", borderRadius: 10, border: "1px solid #1a3a1a", background: "transparent", color: "#86efac", cursor: "pointer" }}>
                  Cancel
                </button>
              </>
            )}

            {voiceState.phase === "recognized" && (
              <>
                <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                <p style={{ fontSize: 18, fontWeight: 800, color: "#4ade80", margin: "0 0 6px" }}>
                  {voiceState.result ? RESULT_STYLE[voiceState.result].label : ""}
                </p>
                <p style={{ fontSize: 13, color: "#86efac", margin: 0 }}>
                  {voiceState.batter?.name}
                  {voiceState.inningKey ? ` · Inning ${parseKey(voiceState.inningKey).base}` : ""}
                </p>
              </>
            )}

            {voiceState.phase === "error" && (
              <>
                <div style={{ fontSize: 44, marginBottom: 12 }}>❓</div>
                <p style={{ fontSize: 15, fontWeight: 700, color: "#fbbf24", margin: "0 0 6px" }}>Not recognized</p>
                {voiceState.transcript && (
                  <p style={{ fontSize: 11, color: "#6b7280", margin: "0 0 20px" }}>"{voiceState.transcript}"</p>
                )}
                <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                  <button
                    onClick={() => voiceState.batter && startVoiceForBatter(voiceState.batter)}
                    style={{ fontSize: 13, padding: "9px 20px", borderRadius: 10, border: "1px solid #4ade80", background: "rgba(74,222,128,0.1)", color: "#4ade80", cursor: "pointer" }}>
                    Try again
                  </button>
                  <button onClick={cancelVoice}
                    style={{ fontSize: 13, padding: "9px 20px", borderRadius: 10, border: "1px solid #1a3a1a", background: "transparent", color: "#86efac", cursor: "pointer" }}>
                    Cancel
                  </button>
                </div>
              </>
            )}

            {voiceState.phase === "no-inning" && (
              <>
                <div style={{ fontSize: 44, marginBottom: 12 }}>⚠️</div>
                <p style={{ fontSize: 15, fontWeight: 700, color: "#fbbf24", margin: "0 0 6px" }}>All innings filled</p>
                <p style={{ fontSize: 12, color: "#9ca3af", margin: "0 0 20px" }}>Clear a cell first or add an inning.</p>
                <button onClick={cancelVoice}
                  style={{ fontSize: 13, padding: "9px 28px", borderRadius: 10, border: "1px solid #1a3a1a", background: "transparent", color: "#86efac", cursor: "pointer" }}>
                  OK
                </button>
              </>
            )}

            {voiceState.phase === "unsupported" && (
              <>
                <div style={{ fontSize: 44, marginBottom: 12 }}>🚫</div>
                <p style={{ fontSize: 15, fontWeight: 700, color: "#f87171", margin: "0 0 6px" }}>Voice not supported</p>
                <p style={{ fontSize: 12, color: "#9ca3af", margin: "0 0 20px" }}>Use Chrome or Edge for voice input.</p>
                <button onClick={cancelVoice}
                  style={{ fontSize: 13, padding: "9px 28px", borderRadius: 10, border: "1px solid #1a3a1a", background: "transparent", color: "#86efac", cursor: "pointer" }}>
                  OK
                </button>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
