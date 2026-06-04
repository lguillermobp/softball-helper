"use client";

import { useState, useMemo } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Player {
  id: string; name: string; jerseyNumber: string | null;
  nationality: string | null; photoUrl: string | null;
}
interface LineupEntry {
  isHome: boolean; battingOrder: number | null; position: string;
  player: Player;
}
interface AtBat {
  id: string; inningNumber: number; isTop: boolean;
  batterId: string; pitcherId: string;
  outcome: string; sequence: number;
}
interface Inning {
  id: string; inningNumber: number; isTop: boolean;
  runsScored: number; completed: boolean;
}
interface PitcherStint {
  id: string; isHome: boolean;
  inningStart: number; isTopStart: boolean; outsAtStart: number;
  inningEnd: number | null; isTopEnd: boolean | null; outsAtEnd: number | null;
  pitcher: { id: string; name: string; jerseyNumber: string | null };
}

interface Substitution {
  id: string; playerOutId: string; playerInId: string;
  battingOrderSpot: number; isReEntry: boolean;
  inningNumber: number; isTop: boolean;
}

interface Props {
  slug: string;
  gameId: string;
  homeTeam: { id: string; name: string; logoUrl?: string | null; players: Player[] };
  awayTeam:  { id: string; name: string; logoUrl?: string | null; players: Player[] };
  homeLineup: LineupEntry[];
  awayLineup: LineupEntry[];
  initialAtBats: AtBat[];
  initialInnings: Inning[];
  initialPitcherStints: PitcherStint[];
  initialSubstitutions?: Substitution[];
  canEdit: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const OUTCOMES = [
  { key: "SINGLE",    label: "1B",  color: "#4ade80" },
  { key: "DOUBLE",    label: "2B",  color: "#60a5fa" },
  { key: "TRIPLE",    label: "3B",  color: "#f59e0b" },
  { key: "HOME_RUN",  label: "HR",  color: "#f87171" },
  { key: "WALK",      label: "BB",  color: "#a78bfa" },
  { key: "OUT",       label: "OUT", color: "#6b7280" },
  { key: "STRIKEOUT", label: "K",   color: "#6b7280" },
] as const;

const OUTCOME_LABEL: Record<string, string> = {
  SINGLE: "1B", DOUBLE: "2B", TRIPLE: "3B", HOME_RUN: "HR",
  WALK: "BB", OUT: "OUT", STRIKEOUT: "K",
};

const OUTCOME_COLOR: Record<string, string> = {
  SINGLE: "#4ade80", DOUBLE: "#60a5fa", TRIPLE: "#f59e0b", HOME_RUN: "#f87171",
  WALK: "#a78bfa", OUT: "#6b7280", STRIKEOUT: "#6b7280",
};

function isOut(outcome: string) { return outcome === "OUT" || outcome === "STRIKEOUT"; }

// ── Component ─────────────────────────────────────────────────────────────────

export function OfficialScorekeeper({
  slug, gameId, homeTeam, awayTeam,
  homeLineup, awayLineup,
  initialAtBats, initialInnings, initialPitcherStints, initialSubstitutions,
  canEdit,
}: Props) {
  const [atBats,        setAtBats]        = useState<AtBat[]>(initialAtBats);
  const [innings,       setInnings]       = useState<Inning[]>(initialInnings);
  const [stints,        setStints]        = useState<PitcherStint[]>(initialPitcherStints);
  const [subs,          setSubs]          = useState<Substitution[]>(initialSubstitutions ?? []);
  // Active lineup reflects substitutions (maps battingOrderSpot → current playerId)
  const [activeHome,    setActiveHome]    = useState<Map<number, string>>(
    () => new Map(homeLineup.map(l => [l.battingOrder!, l.player.id]))
  );
  const [activeAway,    setActiveAway]    = useState<Map<number, string>>(
    () => new Map(awayLineup.map(l => [l.battingOrder!, l.player.id]))
  );
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState("");

  // End-of-half-inning prompt
  const [pendingRuns,   setPendingRuns]   = useState<number | null>(null);

  // Substitution panel
  const [showSubPanel,  setShowSubPanel]  = useState(false);
  const [subSide,       setSubSide]       = useState<"home" | "away">("home");
  const [subOutSpot,    setSubOutSpot]    = useState<number | null>(null);
  const [subInId,       setSubInId]       = useState("");

  // Pitcher setup / change panel
  const [pitcherPanel,  setPitcherPanel]  = useState<"home" | "away" | null>(null);
  const [selectedPId,   setSelectedPId]   = useState("");

  // ── Derived state ────────────────────────────────────────────────────────

  const currentInning = useMemo(() => {
    const completed = innings.filter(i => i.completed);
    const last = completed[completed.length - 1];
    if (!last) return { number: 1, isTop: true };
    return last.isTop
      ? { number: last.inningNumber, isTop: false }
      : { number: last.inningNumber + 1, isTop: true };
  }, [innings]);

  // top of inning = away team bats; bottom = home team bats
  const pitchingIsHome = currentInning.isTop; // home pitches when away bats
  const battingIsHome  = !currentInning.isTop;

  // Build effective batting lineup (original + subs applied)
  const effectiveBatting = useMemo(() => {
    const base = battingIsHome ? homeLineup : awayLineup;
    const active = battingIsHome ? activeHome : activeAway;
    const allPlayers = battingIsHome
      ? [...homeTeam.players, ...homeLineup.map(l => l.player)]
      : [...awayTeam.players, ...awayLineup.map(l => l.player)];
    const playerMap = new Map(allPlayers.map(p => [p.id, p]));
    return base.map(entry => {
      const curId = active.get(entry.battingOrder!) ?? entry.player.id;
      const curPlayer = playerMap.get(curId) ?? entry.player;
      return { ...entry, player: curPlayer };
    });
  }, [battingIsHome, homeLineup, awayLineup, activeHome, activeAway, homeTeam.players, awayTeam.players]);

  const currentHalfABs = atBats.filter(
    ab => ab.inningNumber === currentInning.number && ab.isTop === currentInning.isTop
  );
  const currentOuts = currentHalfABs.filter(ab => isOut(ab.outcome)).length;

  const activePitcher = stints.find(s => s.isHome === pitchingIsHome && s.outsAtEnd == null);

  const currentBatterIdx = effectiveBatting.length > 0
    ? currentHalfABs.length % effectiveBatting.length
    : 0;
  const currentBatter = effectiveBatting[currentBatterIdx];
  const onDeckBatter  = effectiveBatting.length > 1
    ? effectiveBatting[(currentBatterIdx + 1) % effectiveBatting.length]
    : null;

  const needsPitchers = !stints.some(s => s.isHome === true)
                     || !stints.some(s => s.isHome === false);

  const pitchingTeamLineup = pitchingIsHome ? homeLineup : awayLineup;

  // Home/away scores from completed innings
  const homeScore = innings.filter(i => !i.isTop && i.completed).reduce((s, i) => s + i.runsScored, 0);
  const awayScore = innings.filter(i =>  i.isTop && i.completed).reduce((s, i) => s + i.runsScored, 0);

  // ── Actions ──────────────────────────────────────────────────────────────

  async function recordAtBat(outcome: string) {
    if (!canEdit || saving || currentOuts >= 3 || !activePitcher || !currentBatter) return;
    setError("");
    setSaving(true);

    const tempId = `tmp-${Date.now()}`;
    const newAb: AtBat = {
      id: tempId,
      inningNumber: currentInning.number,
      isTop: currentInning.isTop,
      batterId: currentBatter.player.id,
      pitcherId: activePitcher.pitcher.id,
      outcome,
      sequence: currentHalfABs.length + 1,
    };

    setAtBats(prev => [...prev, newAb]);
    const newOuts = currentOuts + (isOut(outcome) ? 1 : 0);
    if (newOuts >= 3) setPendingRuns(0);

    const res = await fetch(`/api/leagues/${slug}/games/${gameId}/at-bat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        outcome,
        batterId:     currentBatter.player.id,
        pitcherId:    activePitcher.pitcher.id,
        inningNumber: currentInning.number,
        isTop:        currentInning.isTop,
        sequence:     currentHalfABs.length + 1,
      }),
    });
    setSaving(false);

    if (!res.ok) {
      setAtBats(prev => prev.filter(ab => ab.id !== tempId));
      setPendingRuns(null);
      const d = await res.json();
      setError(d.error ?? "Failed to record at-bat");
      return;
    }
    const saved: AtBat = await res.json();
    setAtBats(prev => prev.map(ab => ab.id === tempId ? saved : ab));
  }

  async function undoLastAtBat() {
    if (!canEdit || saving || currentHalfABs.length === 0) return;
    const last = [...currentHalfABs].sort((a, b) => b.sequence - a.sequence)[0];
    setError("");
    setSaving(true);
    const res = await fetch(`/api/leagues/${slug}/games/${gameId}/at-bat`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ atBatId: last.id }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Failed to undo");
      return;
    }
    setAtBats(prev => prev.filter(ab => ab.id !== last.id));
    if (pendingRuns !== null) setPendingRuns(null);
  }

  async function confirmInning(runs: number) {
    if (!canEdit || saving) return;
    setError("");
    setSaving(true);
    const res = await fetch(`/api/leagues/${slug}/games/${gameId}/inning`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inningNumber: currentInning.number, isTop: currentInning.isTop, runsScored: runs }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Failed to record inning");
      return;
    }
    const saved: Inning = await res.json();
    setInnings(prev => [
      ...prev.filter(i => !(i.inningNumber === currentInning.number && i.isTop === currentInning.isTop)),
      saved,
    ]);
    setPendingRuns(null);
  }

  async function setPitcher(isHome: boolean, pitcherId: string) {
    if (!canEdit || saving || !pitcherId) return;
    setError("");
    setSaving(true);
    const outsNow = isHome === pitchingIsHome ? currentOuts : 0;
    const res = await fetch(`/api/leagues/${slug}/games/${gameId}/pitcher-change`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pitcherId,
        isHome,
        inningNumber: currentInning.number,
        isTop: currentInning.isTop,
        outsAtChange: outsNow,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Failed to set pitcher");
      return;
    }
    const saved: PitcherStint = await res.json();
    setStints(prev => [
      ...prev.map(s => s.isHome === isHome && s.outsAtEnd == null ? { ...s, outsAtEnd: outsNow } : s),
      saved,
    ]);
    setPitcherPanel(null);
    setSelectedPId("");
  }

  async function makeSubstitution(isHome: boolean, playerOutId: string, battingOrderSpot: number, playerInId: string) {
    if (!canEdit || saving || !playerInId || !playerOutId) return;
    setError("");
    setSaving(true);
    const res = await fetch(`/api/leagues/${slug}/games/${gameId}/substitution`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerOutId, playerInId, battingOrderSpot,
        inningNumber: currentInning.number, isTop: currentInning.isTop,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Substitution failed");
      return;
    }
    const saved: Substitution = await res.json();
    setSubs(prev => [...prev, saved]);
    // Update active lineup map
    if (isHome) {
      setActiveHome(prev => new Map(prev).set(battingOrderSpot, playerInId));
    } else {
      setActiveAway(prev => new Map(prev).set(battingOrderSpot, playerInId));
    }
    setShowSubPanel(false);
    setSubOutSpot(null);
    setSubInId("");
  }

  // ── Styles ───────────────────────────────────────────────────────────────

  const card: React.CSSProperties = { borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" };
  const dim:  React.CSSProperties = { color: "var(--sh-muted)" };

  // ── Initial pitcher setup ────────────────────────────────────────────────

  if (needsPitchers) {
    const homePitcher = homeLineup.find(l => l.position === "P")?.player;
    const awayPitcher = awayLineup.find(l => l.position === "P")?.player;
    const homeSet = stints.some(s => s.isHome === true);
    const awaySet = stints.some(s => s.isHome === false);

    return (
      <div className="rounded-2xl border p-6 space-y-5" style={card}>
        <h2 className="text-base font-bold" style={{ color: "var(--sh-text)" }}>Set Starting Pitchers</h2>
        <p className="text-sm" style={dim}>Before scoring can begin, designate the starting pitcher for each team.</p>

        {[
          { isHome: true,  team: homeTeam, lineup: homeLineup, suggested: homePitcher, done: homeSet },
          { isHome: false, team: awayTeam, lineup: awayLineup, suggested: awayPitcher, done: awaySet },
        ].map(({ isHome, team, lineup, suggested, done }) => (
          <div key={String(isHome)} className="rounded-xl border p-4 space-y-3" style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card2)" }}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold" style={{ color: "var(--sh-text)" }}>{team.name}</span>
              {done && <span className="text-xs" style={{ color: "var(--sh-primary)" }}>✓ Set</span>}
            </div>
            {!done && (
              <div className="space-y-2">
                <select
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                  style={{ background: "var(--sh-bg-card)", borderColor: "var(--sh-border)", color: "var(--sh-text)" }}
                  defaultValue={suggested?.id ?? ""}
                  onChange={e => setSelectedPId(e.target.value)}
                  id={`pitcher-${String(isHome)}`}
                >
                  <option value="">— Select pitcher —</option>
                  {lineup.map(l => (
                    <option key={l.player.id} value={l.player.id}>
                      #{l.battingOrder} {l.player.name}{l.player.jerseyNumber ? ` (#${l.player.jerseyNumber})` : ""} — {l.position}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    const sel = (document.getElementById(`pitcher-${String(isHome)}`) as HTMLSelectElement)?.value;
                    if (sel) setPitcher(isHome, sel);
                  }}
                  disabled={saving}
                  className="text-xs px-4 py-1.5 rounded-lg font-bold disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg,#16a34a,#15803d)", color: "#fff" }}
                >
                  {saving ? "Saving…" : "Confirm pitcher"}
                </button>
              </div>
            )}
          </div>
        ))}
        {error && <p className="text-xs" style={{ color: "var(--sh-danger)" }}>{error}</p>}
      </div>
    );
  }

  // ── Main scoring UI ──────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* Score & inning header */}
      <div className="rounded-2xl border p-4" style={card}>
        <div className="flex items-center justify-between gap-4">
          <div className="text-center flex-1">
            <div className="text-xs font-semibold uppercase mb-1" style={dim}>{awayTeam.name}</div>
            <div className="text-3xl font-black" style={{ color: "var(--sh-text)" }}>{awayScore}</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-bold" style={{ color: "var(--sh-warn)" }}>
              {currentInning.isTop ? "▲" : "▼"} {currentInning.number}
            </div>
            <div className="flex gap-1 mt-1 justify-center">
              {[0, 1, 2].map(i => (
                <span key={i} className="w-3 h-3 rounded-full border" style={{
                  borderColor: "var(--sh-border2)",
                  background: i < currentOuts ? "var(--sh-warn)" : "transparent",
                }} />
              ))}
            </div>
            <div className="text-xs mt-1" style={dim}>{currentOuts} out{currentOuts !== 1 ? "s" : ""}</div>
          </div>
          <div className="text-center flex-1">
            <div className="text-xs font-semibold uppercase mb-1" style={dim}>{homeTeam.name}</div>
            <div className="text-3xl font-black" style={{ color: "var(--sh-text)" }}>{homeScore}</div>
          </div>
        </div>
      </div>

      {/* 3-out prompt — enter runs before continuing */}
      {pendingRuns !== null ? (
        <div className="rounded-2xl border p-5 space-y-4" style={{ ...card, borderColor: "var(--sh-warn)" }}>
          <div className="text-sm font-bold text-center" style={{ color: "var(--sh-warn)" }}>
            3 outs — {currentInning.isTop ? awayTeam.name : homeTeam.name} half-inning over
          </div>
          <div>
            <p className="text-xs mb-2 text-center" style={dim}>Runs scored this half-inning:</p>
            <div className="flex gap-2 justify-center flex-wrap">
              {[0, 1, 2, 3, 4, 5, 6, 7].map(r => (
                <button
                  key={r}
                  onClick={() => setPendingRuns(r)}
                  className="w-10 h-10 rounded-xl font-bold text-sm border transition-all"
                  style={pendingRuns === r
                    ? { background: "var(--sh-primary-dark)", color: "#fff", borderColor: "var(--sh-primary)" }
                    : { borderColor: "var(--sh-border2)", color: "var(--sh-text)", background: "var(--sh-bg-card2)" }}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => confirmInning(pendingRuns)}
            disabled={saving}
            className="w-full py-2.5 rounded-xl font-bold text-sm disabled:opacity-40"
            style={{ background: "linear-gradient(135deg,#16a34a,#15803d)", color: "#fff" }}
          >
            {saving ? "Saving…" : `Confirm ${pendingRuns} run${pendingRuns !== 1 ? "s" : ""} → next half-inning`}
          </button>
        </div>
      ) : (
        <>
          {/* Current batter + pitcher */}
          <div className="rounded-2xl border p-4 space-y-3" style={card}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs font-semibold uppercase mb-0.5" style={dim}>
                  At bat · {currentInning.isTop ? awayTeam.name : homeTeam.name}
                </div>
                {currentBatter ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold" style={{ color: "var(--sh-text)" }}>{currentBatter.player.name}</span>
                    {currentBatter.player.jerseyNumber && (
                      <span className="text-sm" style={dim}>#{currentBatter.player.jerseyNumber}</span>
                    )}
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--sh-bg-card2)", color: "var(--sh-muted)" }}>
                      #{currentBatter.battingOrder}
                    </span>
                  </div>
                ) : (
                  <span className="text-sm" style={dim}>No lineup</span>
                )}
                {onDeckBatter && (
                  <div className="text-xs mt-1" style={dim}>
                    On deck: {onDeckBatter.player.name}
                    {onDeckBatter.player.jerseyNumber ? ` #${onDeckBatter.player.jerseyNumber}` : ""}
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold uppercase mb-0.5" style={dim}>Pitching</div>
                {activePitcher ? (
                  <div className="text-sm font-semibold" style={{ color: "var(--sh-secondary)" }}>
                    {activePitcher.pitcher.name}
                    {activePitcher.pitcher.jerseyNumber ? ` #${activePitcher.pitcher.jerseyNumber}` : ""}
                  </div>
                ) : (
                  <span className="text-xs" style={{ color: "var(--sh-danger)" }}>No pitcher</span>
                )}
              </div>
            </div>

            {/* Outcome buttons */}
            {canEdit && (
              <div className="grid grid-cols-7 gap-1.5">
                {OUTCOMES.map(({ key, label, color }) => (
                  <button
                    key={key}
                    onClick={() => recordAtBat(key)}
                    disabled={saving || !activePitcher || !currentBatter}
                    className="py-3 rounded-xl font-bold text-sm border transition-all hover:opacity-80 disabled:opacity-30"
                    style={{ borderColor: color, color, background: "transparent" }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* Undo + pitcher change */}
            {canEdit && (
              <div className="flex gap-2 pt-1">
                <button
                  onClick={undoLastAtBat}
                  disabled={saving || currentHalfABs.length === 0}
                  className="text-xs px-3 py-1.5 rounded-lg border transition-opacity hover:opacity-70 disabled:opacity-30"
                  style={{ borderColor: "var(--sh-border2)", color: "var(--sh-muted)" }}
                >
                  ↩ Undo last
                </button>
                <button
                  onClick={() => {
                    setPitcherPanel(pitchingIsHome ? "home" : "away");
                    setSelectedPId(activePitcher?.pitcher.id ?? "");
                  }}
                  disabled={saving}
                  className="text-xs px-3 py-1.5 rounded-lg border transition-opacity hover:opacity-70 disabled:opacity-30"
                  style={{ borderColor: "var(--sh-border2)", color: "var(--sh-secondary)" }}
                >
                  ⚾ Change pitcher
                </button>
                <button
                  onClick={() => {
                    setSubSide(battingIsHome ? "home" : "away");
                    setSubOutSpot(null);
                    setSubInId("");
                    setShowSubPanel(true);
                  }}
                  disabled={saving}
                  className="text-xs px-3 py-1.5 rounded-lg border transition-opacity hover:opacity-70 disabled:opacity-30"
                  style={{ borderColor: "var(--sh-border2)", color: "#f59e0b" }}
                >
                  ↔ Sub player
                </button>
                {pendingRuns === null && currentOuts === 3 && (
                  <button
                    onClick={() => setPendingRuns(0)}
                    className="text-xs px-3 py-1.5 rounded-lg border font-semibold"
                    style={{ borderColor: "var(--sh-warn)", color: "var(--sh-warn)" }}
                  >
                    End half-inning
                  </button>
                )}
              </div>
            )}
            {error && <p className="text-xs" style={{ color: "var(--sh-danger)" }}>{error}</p>}
          </div>

          {/* This half-inning plays */}
          {currentHalfABs.length > 0 && (
            <div className="rounded-2xl border p-4" style={card}>
              <h3 className="text-xs font-semibold uppercase mb-3" style={dim}>
                {currentInning.isTop ? "▲" : "▼"} {currentInning.number} — at-bats
              </h3>
              <div className="space-y-1.5">
                {currentHalfABs.map((ab, idx) => {
                  const batter = effectiveBatting[idx % effectiveBatting.length];
                  return (
                    <div key={ab.id} className="flex items-center gap-2 text-sm">
                      <span style={{ color: "var(--sh-muted)", minWidth: 16, textAlign: "right" }}>{ab.sequence}.</span>
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: "var(--sh-bg-card2)", color: OUTCOME_COLOR[ab.outcome] }}>
                        {OUTCOME_LABEL[ab.outcome]}
                      </span>
                      <span style={{ color: "var(--sh-text)" }}>{batter?.player.name ?? "—"}</span>
                      {batter?.player.jerseyNumber && (
                        <span style={{ color: "var(--sh-muted)", fontSize: 11 }}>#{batter.player.jerseyNumber}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Pitcher change panel */}
      {pitcherPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="w-full max-w-sm rounded-2xl border p-5 space-y-4" style={{ background: "var(--sh-bg-card)", borderColor: "var(--sh-border)" }}>
            <h2 className="text-base font-bold" style={{ color: "var(--sh-text)" }}>
              Change Pitcher — {pitcherPanel === "home" ? homeTeam.name : awayTeam.name}
            </h2>
            <select
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
              style={{ background: "var(--sh-bg-card2)", borderColor: "var(--sh-border)", color: "var(--sh-text)" }}
              value={selectedPId}
              onChange={e => setSelectedPId(e.target.value)}
            >
              <option value="">— Select new pitcher —</option>
              {pitchingTeamLineup.map(l => (
                <option key={l.player.id} value={l.player.id}>
                  #{l.battingOrder} {l.player.name}{l.player.jerseyNumber ? ` (#${l.player.jerseyNumber})` : ""} — {l.position}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={() => setPitcher(pitcherPanel === "home", selectedPId)}
                disabled={saving || !selectedPId}
                className="flex-1 py-2 rounded-xl font-bold text-sm disabled:opacity-40"
                style={{ background: "linear-gradient(135deg,#16a34a,#15803d)", color: "#fff" }}
              >
                {saving ? "Saving…" : "Confirm"}
              </button>
              <button
                onClick={() => { setPitcherPanel(null); setSelectedPId(""); }}
                className="flex-1 py-2 rounded-xl text-sm border"
                style={{ borderColor: "var(--sh-border2)", color: "var(--sh-muted)" }}
              >
                Cancel
              </button>
            </div>
            {error && <p className="text-xs" style={{ color: "var(--sh-danger)" }}>{error}</p>}
          </div>
        </div>
      )}

      {/* Substitution panel */}
      {showSubPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="w-full max-w-sm rounded-2xl border p-5 space-y-4" style={{ background: "var(--sh-bg-card)", borderColor: "var(--sh-border)" }}>
            <h2 className="text-base font-bold" style={{ color: "var(--sh-text)" }}>
              ↔ Substitution — {subSide === "home" ? homeTeam.name : awayTeam.name}
            </h2>

            {/* Step 1: who leaves */}
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase" style={{ color: "var(--sh-muted)" }}>Player out (batting spot)</label>
              <select
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                style={{ background: "var(--sh-bg-card2)", borderColor: "var(--sh-border)", color: "var(--sh-text)" }}
                value={subOutSpot ?? ""}
                onChange={e => setSubOutSpot(Number(e.target.value) || null)}
              >
                <option value="">— Select batter leaving —</option>
                {effectiveBatting.map(l => (
                  <option key={l.player.id} value={l.battingOrder!}>
                    #{l.battingOrder} {l.player.name}{l.player.jerseyNumber ? ` (#${l.player.jerseyNumber})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Step 2: who enters */}
            {subOutSpot != null && (() => {
              const battingTeamPlayers = subSide === "home" ? homeTeam.players : awayTeam.players;
              const activePlayers = new Set([
                ...(subSide === "home" ? activeHome : activeAway).values(),
              ]);
              const available = battingTeamPlayers.filter(p => !activePlayers.has(p.id));
              const subbedOutIds = new Set(subs.filter(s => s.isTop !== (subSide === "home")).map(s => s.playerOutId));
              const reEntryPlayers = battingTeamPlayers.filter(p => subbedOutIds.has(p.id) && !activePlayers.has(p.id));

              return (
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase" style={{ color: "var(--sh-muted)" }}>Player in</label>
                  <select
                    className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                    style={{ background: "var(--sh-bg-card2)", borderColor: "var(--sh-border)", color: "var(--sh-text)" }}
                    value={subInId}
                    onChange={e => setSubInId(e.target.value)}
                  >
                    <option value="">— Select player entering —</option>
                    {available.length > 0 && <optgroup label="Available">
                      {available.map(p => (
                        <option key={p.id} value={p.id}>{p.name}{p.jerseyNumber ? ` #${p.jerseyNumber}` : ""}</option>
                      ))}
                    </optgroup>}
                    {reEntryPlayers.length > 0 && <optgroup label="Re-entry">
                      {reEntryPlayers.map(p => (
                        <option key={p.id} value={p.id}>{p.name}{p.jerseyNumber ? ` #${p.jerseyNumber}` : ""} ↩</option>
                      ))}
                    </optgroup>}
                  </select>
                </div>
              );
            })()}

            <div className="flex gap-2">
              <button
                onClick={() => {
                  const outEntry = effectiveBatting.find(l => l.battingOrder === subOutSpot);
                  if (!outEntry || !subInId || subOutSpot == null) return;
                  makeSubstitution(subSide === "home", outEntry.player.id, subOutSpot, subInId);
                }}
                disabled={saving || !subInId || subOutSpot == null}
                className="flex-1 py-2 rounded-xl font-bold text-sm disabled:opacity-40"
                style={{ background: "linear-gradient(135deg,#d97706,#b45309)", color: "#fff" }}
              >
                {saving ? "Saving…" : "Confirm sub"}
              </button>
              <button
                onClick={() => { setShowSubPanel(false); setSubOutSpot(null); setSubInId(""); }}
                className="flex-1 py-2 rounded-xl text-sm border"
                style={{ borderColor: "var(--sh-border2)", color: "var(--sh-muted)" }}
              >
                Cancel
              </button>
            </div>
            {error && <p className="text-xs" style={{ color: "var(--sh-danger)" }}>{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
