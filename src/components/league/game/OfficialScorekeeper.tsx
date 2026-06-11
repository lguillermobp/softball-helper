"use client";

import { useState, useMemo, useEffect } from "react";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";

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
  carryOverBattingOrder: number | null;
}
interface RunnerOut {
  id: string; inningNumber: number; isTop: boolean; sequence: number;
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
  initialRunnerOuts?: RunnerOut[];
  initialPitcherStints: PitcherStint[];
  initialSubstitutions?: Substitution[];
  startedAt?: string | null;
  defaultGameDurationMins?: number | null;
  canEdit: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const OUTCOMES_ROW1 = [
  { key: "WALK",        label: "BB",  color: "#a78bfa" },
  { key: "SINGLE",      label: "1B",  color: "#4ade80" },
  { key: "DOUBLE",      label: "2B",  color: "#60a5fa" },
  { key: "TRIPLE",      label: "3B",  color: "#f59e0b" },
  { key: "HOME_RUN",    label: "HR",  color: "#f87171" },
  { key: "ERROR",       label: "E",   color: "#fb923c" },
] as const;

const OUTCOMES_ROW2 = [
  { key: "OUT",         label: "OUT", color: "#6b7280" },
  { key: "STRIKEOUT",   label: "K",   color: "#6b7280" },
  { key: "DOUBLE_PLAY", label: "DP",  color: "#6b7280" },
  { key: "TRIPLE_PLAY", label: "TP",  color: "#6b7280" },
] as const;

const OUTCOME_LABEL: Record<string, string> = {
  SINGLE: "1B", DOUBLE: "2B", TRIPLE: "3B", HOME_RUN: "HR",
  WALK: "BB", ERROR: "E", OUT: "OUT", STRIKEOUT: "K",
  DOUBLE_PLAY: "DP", TRIPLE_PLAY: "TP",
};

const OUTCOME_COLOR: Record<string, string> = {
  SINGLE: "#4ade80", DOUBLE: "#60a5fa", TRIPLE: "#f59e0b", HOME_RUN: "#f87171",
  WALK: "#a78bfa", ERROR: "#fb923c", OUT: "#6b7280", STRIKEOUT: "#6b7280",
  DOUBLE_PLAY: "#6b7280", TRIPLE_PLAY: "#6b7280",
};

function outCount(outcome: string): number {
  if (outcome === "DOUBLE_PLAY") return 2;
  if (outcome === "TRIPLE_PLAY") return 3;
  if (outcome === "OUT" || outcome === "STRIKEOUT") return 1;
  return 0;
}
function isOut(outcome: string) { return outCount(outcome) > 0; }

function PlayerAvatar({ player, size = 36, onClick }: { player: { name: string; jerseyNumber?: string | null; photoUrl?: string | null }; size?: number; onClick?: () => void }) {
  const initials = player.jerseyNumber ? `#${player.jerseyNumber}` : player.name.charAt(0).toUpperCase();
  const cursor = onClick ? "cursor-zoom-in" : "";
  if (player.photoUrl) {
    return (
      <img
        src={player.photoUrl}
        alt={player.name}
        width={size} height={size}
        className={cursor}
        onClick={onClick}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "2px solid var(--sh-border)" }}
      />
    );
  }
  return (
    <div
      className={cursor}
      onClick={onClick}
      style={{
        width: size, height: size, borderRadius: "50%", flexShrink: 0,
        background: "var(--sh-bg-card2)", border: "2px solid var(--sh-border)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.35, fontWeight: 700, color: "var(--sh-muted)",
      }}
    >
      {initials}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function OfficialScorekeeper({
  slug, gameId, homeTeam, awayTeam,
  homeLineup, awayLineup,
  initialAtBats, initialInnings, initialRunnerOuts, initialPitcherStints, initialSubstitutions,
  startedAt, defaultGameDurationMins,
  canEdit,
}: Props) {
  const [atBats,      setAtBats]      = useState<AtBat[]>(initialAtBats);
  const [innings,     setInnings]     = useState<Inning[]>(initialInnings);
  const [runnerOuts,  setRunnerOuts]  = useState<RunnerOut[]>(initialRunnerOuts ?? []);
  const [stints,      setStints]      = useState<PitcherStint[]>(initialPitcherStints);
  const [subs,        setSubs]        = useState<Substitution[]>(initialSubstitutions ?? []);
  // Active lineup reflects substitutions (maps battingOrderSpot → current playerId)
  const [activeHome,    setActiveHome]    = useState<Map<number, string>>(
    () => new Map(homeLineup.map(l => [l.battingOrder!, l.player.id]))
  );
  const [activeAway,    setActiveAway]    = useState<Map<number, string>>(
    () => new Map(awayLineup.map(l => [l.battingOrder!, l.player.id]))
  );
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState("");
  const [enlargedPhoto, setEnlargedPhoto] = useState<{ url: string; name: string } | null>(null);
  const [now,           setNow]           = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const { isOnline, queueLength, syncing, syncError, clearSyncError, enqueue } = useOfflineQueue(gameId);

  // End-of-half-inning prompt
  const [pendingRuns,       setPendingRuns]       = useState<number | null>(null);
  // Carry-over: batting order spot that should lead off next inning
  const [pendingCarryOver,  setPendingCarryOver]  = useState<number | null>(null);

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
  const currentHalfROs = runnerOuts.filter(
    ro => ro.inningNumber === currentInning.number && ro.isTop === currentInning.isTop
  );
  const currentOuts = currentHalfABs.reduce((sum, ab) => sum + outCount(ab.outcome), 0) + currentHalfROs.length;

  const activePitcher = stints.find(s => s.isHome === pitchingIsHome && s.outsAtEnd == null);
  const pitchingTeam  = pitchingIsHome ? homeTeam : awayTeam;
  const activePitcherFull = activePitcher
    ? pitchingTeam.players.find(p => p.id === activePitcher.pitcher.id) ?? null
    : null;

  // Carry-over: if the previous inning (same isTop) ended with a carry-over batter,
  // that batter leads off this inning instead of continuing the normal rotation.
  const prevInningForTeam = innings.find(
    i => i.isTop === currentInning.isTop && i.inningNumber === currentInning.number - 1
  );
  const carryOverOrder = prevInningForTeam?.carryOverBattingOrder ?? null;
  const carryOverStartIdx = carryOverOrder != null && effectiveBatting.length > 0
    ? effectiveBatting.findIndex(l => l.battingOrder === carryOverOrder)
    : -1;
  const startIdx = carryOverStartIdx >= 0 ? carryOverStartIdx : 0;

  const currentBatterIdx = effectiveBatting.length > 0
    ? (startIdx + currentHalfABs.length) % effectiveBatting.length
    : 0;
  const currentBatter  = effectiveBatting[currentBatterIdx];
  const onDeckBatter   = effectiveBatting.length > 1
    ? effectiveBatting[(currentBatterIdx + 1) % effectiveBatting.length]
    : null;
  const inHoleBatter   = effectiveBatting.length > 2
    ? effectiveBatting[(currentBatterIdx + 2) % effectiveBatting.length]
    : null;

  // Per-player game stats derived from all at-bats so far
  function playerStats(playerId: string) {
    const pABs = atBats.filter(ab => ab.batterId === playerId);
    const hits  = pABs.filter(ab => ["SINGLE","DOUBLE","TRIPLE","HOME_RUN"].includes(ab.outcome)).length;
    const ab    = pABs.filter(ab => !["WALK"].includes(ab.outcome)).length;
    const bb    = pABs.filter(ab => ab.outcome === "WALK").length;
    const k     = pABs.filter(ab => ab.outcome === "STRIKEOUT").length;
    const hr    = pABs.filter(ab => ab.outcome === "HOME_RUN").length;
    return { ab, hits, bb, k, hr };
  }

  const needsPitchers = !stints.some(s => s.isHome === true)
                     || !stints.some(s => s.isHome === false);

  const pitchingTeamLineup = pitchingIsHome ? homeLineup : awayLineup;

  // Home/away scores from completed innings
  const homeScore = innings.filter(i => !i.isTop && i.completed).reduce((s, i) => s + i.runsScored, 0);
  const awayScore = innings.filter(i =>  i.isTop && i.completed).reduce((s, i) => s + i.runsScored, 0);

  // Match timing
  const startDate       = startedAt ? new Date(startedAt) : null;
  const scheduledEndDate = startDate && defaultGameDurationMins
    ? new Date(startDate.getTime() + defaultGameDurationMins * 60_000)
    : null;
  const remainingMs     = scheduledEndDate ? scheduledEndDate.getTime() - now.getTime() : null;
  const remainingMins   = remainingMs != null ? Math.ceil(remainingMs / 60_000) : null;
  const isUrgent        = remainingMins != null && remainingMins <= 10;
  const isOvertime      = remainingMins != null && remainingMins < 0;

  function fmtTime(d: Date) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  function fmtRemaining(mins: number) {
    if (mins <= 0) {
      const over = Math.abs(mins);
      return over < 60 ? `+${over}m overtime` : `+${Math.floor(over / 60)}h ${over % 60}m overtime`;
    }
    return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }

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
    const newOuts = currentOuts + outCount(outcome);
    if (newOuts >= 3) setPendingRuns(0);

    const result = await enqueue(
      `/api/leagues/${slug}/games/${gameId}/at-bat`, "POST",
      {
        outcome,
        batterId:     currentBatter.player.id,
        pitcherId:    activePitcher.pitcher.id,
        inningNumber: currentInning.number,
        isTop:        currentInning.isTop,
        sequence:     currentHalfABs.length + 1,
      },
    );
    setSaving(false);

    if (!result.ok) {
      setAtBats(prev => prev.filter(ab => ab.id !== tempId));
      setPendingRuns(null);
      setError(result.error ?? "Failed to record at-bat");
      return;
    }
    if (!result.queued && result.data) {
      const saved = result.data as AtBat;
      setAtBats(prev => prev.map(ab => ab.id === tempId ? saved : ab));
    }
  }

  async function undoLastAtBat() {
    if (!canEdit || saving) return;
    if (!isOnline) { setError("Cannot undo while offline"); return; }

    const lastAB = currentHalfABs.length > 0
      ? [...currentHalfABs].sort((a, b) => b.sequence - a.sequence)[0]
      : null;
    const lastRO = currentHalfROs.length > 0
      ? [...currentHalfROs].sort((a, b) => b.sequence - a.sequence)[0]
      : null;

    if (!lastAB && !lastRO) return;

    // Pick whichever happened last
    const undoRO = lastRO && (!lastAB || lastRO.sequence > lastAB.sequence);

    if (undoRO) {
      if (lastRO!.id.startsWith("tmp-ro-")) {
        setRunnerOuts(prev => prev.filter(r => r.id !== lastRO!.id));
        if (pendingRuns !== null) setPendingRuns(null);
        if (pendingCarryOver !== null) setPendingCarryOver(null);
        return;
      }
      setError("");
      setSaving(true);
      const result = await enqueue(
        `/api/leagues/${slug}/games/${gameId}/runner-out`, "DELETE",
        { runnerOutId: lastRO!.id },
      );
      setSaving(false);
      if (!result.ok) { setError(result.error ?? "Failed to undo runner out"); return; }
      setRunnerOuts(prev => prev.filter(r => r.id !== lastRO!.id));
      if (pendingRuns !== null) setPendingRuns(null);
      if (pendingCarryOver !== null) setPendingCarryOver(null);
      return;
    }

    // Undo last at-bat
    if (lastAB!.id.startsWith("tmp-")) {
      setAtBats(prev => prev.filter(ab => ab.id !== lastAB!.id));
      if (pendingRuns !== null) setPendingRuns(null);
      return;
    }
    setError("");
    setSaving(true);
    const result = await enqueue(
      `/api/leagues/${slug}/games/${gameId}/at-bat`, "DELETE",
      { atBatId: lastAB!.id },
    );
    setSaving(false);
    if (!result.ok) { setError(result.error ?? "Failed to undo"); return; }
    setAtBats(prev => prev.filter(ab => ab.id !== lastAB!.id));
    if (pendingRuns !== null) setPendingRuns(null);
  }

  async function recordRunnerOut() {
    if (!canEdit || saving || currentOuts >= 3 || !currentBatter) return;
    setError("");
    setSaving(true);

    const willBe3rd = currentOuts + 1 >= 3;
    const carryOver = willBe3rd ? (currentBatter.battingOrder ?? null) : null;

    const tempId = `tmp-ro-${Date.now()}`;
    const newRO: RunnerOut = {
      id: tempId,
      inningNumber: currentInning.number,
      isTop: currentInning.isTop,
      sequence: currentHalfABs.length + currentHalfROs.length + 1,
    };
    setRunnerOuts(prev => [...prev, newRO]);
    if (willBe3rd) {
      setPendingRuns(0);
      setPendingCarryOver(carryOver);
    }

    const result = await enqueue(
      `/api/leagues/${slug}/games/${gameId}/runner-out`, "POST",
      {
        inningNumber: currentInning.number,
        isTop: currentInning.isTop,
        sequence: newRO.sequence,
        ...(carryOver != null ? { carryOverBattingOrder: carryOver } : {}),
      },
    );
    setSaving(false);
    if (!result.ok) {
      setRunnerOuts(prev => prev.filter(r => r.id !== tempId));
      if (willBe3rd) { setPendingRuns(null); setPendingCarryOver(null); }
      setError(result.error ?? "Failed to record runner out");
      return;
    }
    if (!result.queued && result.data) {
      const saved = result.data as RunnerOut;
      setRunnerOuts(prev => prev.map(r => r.id === tempId ? saved : r));
    }
  }

  async function confirmInning(runs: number) {
    if (!canEdit || saving) return;
    setError("");
    setSaving(true);
    const body = {
      inningNumber: currentInning.number, isTop: currentInning.isTop, runsScored: runs,
      ...(pendingCarryOver != null ? { carryOverBattingOrder: pendingCarryOver } : {}),
    };
    const optimistic: Inning = {
      id: `tmp-inn-${Date.now()}`, ...body, completed: true,
      carryOverBattingOrder: pendingCarryOver ?? null,
    };
    setInnings(prev => [
      ...prev.filter(i => !(i.inningNumber === currentInning.number && i.isTop === currentInning.isTop)),
      optimistic,
    ]);
    // Remove runner outs for the completed half-inning so the new inning starts at 0 outs
    setRunnerOuts(prev => prev.filter(ro => !(ro.inningNumber === body.inningNumber && ro.isTop === body.isTop)));
    setPendingRuns(null);
    setPendingCarryOver(null);
    const result = await enqueue(`/api/leagues/${slug}/games/${gameId}/inning`, "POST", body);
    setSaving(false);
    if (!result.ok) {
      // Revert optimistic inning
      setInnings(prev => prev.filter(i => i.id !== optimistic.id));
      setPendingRuns(runs);
      setError(result.error ?? "Failed to record inning");
      return;
    }
    if (!result.queued && result.data) {
      const saved = result.data as Inning;
      setInnings(prev => prev.map(i => i.id === optimistic.id ? saved : i));
    }
  }

  async function setPitcher(isHome: boolean, pitcherId: string) {
    if (!canEdit || saving || !pitcherId) return;
    setError("");
    setSaving(true);
    const outsNow = isHome === pitchingIsHome ? currentOuts : 0;
    const body = { pitcherId, isHome, inningNumber: currentInning.number, isTop: currentInning.isTop, outsAtChange: outsNow };
    // Optimistic: close current stint + open new one locally
    const newStint: PitcherStint = {
      id: `tmp-stint-${Date.now()}`, isHome,
      inningStart: currentInning.number, isTopStart: currentInning.isTop, outsAtStart: outsNow,
      inningEnd: null, isTopEnd: null, outsAtEnd: null,
      pitcher: { id: pitcherId, name: "...", jerseyNumber: null },
    };
    setStints(prev => [
      ...prev.map(s => s.isHome === isHome && s.outsAtEnd == null ? { ...s, outsAtEnd: outsNow } : s),
      newStint,
    ]);
    setPitcherPanel(null);
    setSelectedPId("");
    const result = await enqueue(`/api/leagues/${slug}/games/${gameId}/pitcher-change`, "POST", body);
    setSaving(false);
    if (!result.ok) {
      // Revert optimistic stint
      setStints(prev => prev.filter(s => s.id !== newStint.id).map(s =>
        s.isHome === isHome && s.outsAtEnd === outsNow ? { ...s, outsAtEnd: null } : s
      ));
      setError(result.error ?? "Failed to set pitcher");
      return;
    }
    if (!result.queued && result.data) {
      const saved = result.data as PitcherStint;
      setStints(prev => prev.map(s => s.id === newStint.id ? saved : s));
    }
  }

  async function makeSubstitution(isHome: boolean, playerOutId: string, battingOrderSpot: number, playerInId: string) {
    if (!canEdit || saving || !playerInId || !playerOutId) return;
    setError("");
    setSaving(true);
    const body = { playerOutId, playerInId, battingOrderSpot, inningNumber: currentInning.number, isTop: currentInning.isTop };
    const result = await enqueue(`/api/leagues/${slug}/games/${gameId}/substitution`, "POST", body);
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "Substitution failed");
      return;
    }
    const saved: Substitution = (result.data as Substitution) ?? {
      id: `tmp-sub-${Date.now()}`, playerOutId, playerInId, battingOrderSpot,
      isReEntry: subs.some(s => s.playerOutId === playerInId),
      inningNumber: currentInning.number, isTop: currentInning.isTop,
    };
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

      {/* Connectivity indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="w-2 h-2 rounded-full" style={{
            background: !isOnline ? "#f87171" : syncing ? "#f59e0b" : "#4ade80",
          }} />
          <span style={{ color: "var(--sh-muted)" }}>
            {!isOnline
              ? `Offline${queueLength > 0 ? ` · ${queueLength} action${queueLength !== 1 ? "s" : ""} queued` : ""}`
              : syncing
              ? `Syncing ${queueLength} action${queueLength !== 1 ? "s" : ""}…`
              : queueLength > 0
              ? `Online · ${queueLength} pending`
              : "Online · All synced"}
          </span>
        </div>
        {syncError && (
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: "var(--sh-danger)" }}>{syncError}</span>
            <button onClick={clearSyncError} className="text-xs" style={{ color: "var(--sh-muted)" }}>✕</button>
          </div>
        )}
      </div>

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

      {/* Match timing row */}
      {startDate && (
        <div className="rounded-2xl border px-4 py-2.5 flex items-center justify-between gap-2 flex-wrap" style={card}>
          <div className="text-xs" style={{ color: "var(--sh-muted)" }}>
            <span className="font-semibold uppercase tracking-wide mr-1" style={{ fontSize: 10 }}>Started</span>
            {fmtTime(startDate)}
          </div>
          {scheduledEndDate && (
            <div className="text-xs" style={{ color: "var(--sh-muted)" }}>
              <span className="font-semibold uppercase tracking-wide mr-1" style={{ fontSize: 10 }}>Ends</span>
              {fmtTime(scheduledEndDate)}
            </div>
          )}
          {remainingMins != null && (
            <div className="text-sm font-bold flex items-center gap-1" style={{ color: isOvertime ? "#ef4444" : isUrgent ? "#ef4444" : "var(--sh-text)" }}>
              {isOvertime || isUrgent ? "⏱" : "⏳"}
              {fmtRemaining(remainingMins)}
              {!isOvertime && !isUrgent && <span className="text-xs font-normal ml-0.5" style={{ color: "var(--sh-muted)" }}>left</span>}
            </div>
          )}
        </div>
      )}

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
          {pendingCarryOver != null && currentBatter && (
            <div className="rounded-xl px-3 py-2 text-xs text-center font-medium" style={{ background: "#1c1917", color: "#fb923c", border: "1px solid #431407" }}>
              ⚠ Runner out ended the inning — <strong>{currentBatter.player.name}</strong> carries over and bats first next inning
            </div>
          )}
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
            {carryOverOrder != null && currentHalfABs.length === 0 && (
              <div className="rounded-xl px-3 py-2 text-xs text-center font-medium" style={{ background: "#1c1917", color: "#fb923c", border: "1px solid #431407" }}>
                ⚠ Carry-over at-bat — this batter's turn was interrupted last inning
              </div>
            )}
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs font-semibold uppercase mb-0.5" style={dim}>
                  At bat · {currentInning.isTop ? awayTeam.name : homeTeam.name}
                </div>
                {currentBatter ? (() => {
                  const st = playerStats(currentBatter.player.id);
                  const statLine = `${st.hits}-${st.ab}${st.bb ? ` · ${st.bb} BB` : ""}${st.k ? ` · ${st.k} K` : ""}${st.hr ? ` · ${st.hr} HR` : ""}`;
                  return (
                    <div className="flex items-center gap-2">
                      <PlayerAvatar
                        player={currentBatter.player}
                        size={56}
                        onClick={currentBatter.player.photoUrl ? () => setEnlargedPhoto({ url: currentBatter.player.photoUrl!, name: currentBatter.player.name }) : undefined}
                      />
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xl font-bold" style={{ color: "var(--sh-text)" }}>{currentBatter.player.name}</span>
                          {currentBatter.player.jerseyNumber && (
                            <span className="text-sm" style={dim}>#{currentBatter.player.jerseyNumber}</span>
                          )}
                          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--sh-bg-card2)", color: "var(--sh-muted)" }}>
                            #{currentBatter.battingOrder}
                          </span>
                        </div>
                        {st.ab > 0 && (
                          <div className="text-xs mt-0.5" style={{ color: "var(--sh-muted)" }}>{statLine}</div>
                        )}
                      </div>
                    </div>
                  );
                })() : (
                  <span className="text-sm" style={dim}>No lineup</span>
                )}
                {/* On deck + in the hole */}
                {(onDeckBatter || inHoleBatter) && (
                  <div className="flex items-center gap-3 mt-1 pt-2" style={{ borderTop: "1px solid var(--sh-border)" }}>
                    {onDeckBatter && (() => {
                      const st = playerStats(onDeckBatter.player.id);
                      return (
                        <div className="flex items-center gap-1.5">
                          <PlayerAvatar
                            player={onDeckBatter.player}
                            size={44}
                            onClick={onDeckBatter.player.photoUrl ? () => setEnlargedPhoto({ url: onDeckBatter.player.photoUrl!, name: onDeckBatter.player.name }) : undefined}
                          />
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: "var(--sh-muted)", fontSize: 9 }}>On deck</div>
                            <div className="text-sm font-semibold" style={{ color: "var(--sh-text)" }}>
                              {onDeckBatter.player.name}
                              {onDeckBatter.player.jerseyNumber && <span className="ml-1 font-normal" style={dim}>#{onDeckBatter.player.jerseyNumber}</span>}
                            </div>
                            {st.ab > 0 && <div className="text-xs" style={{ color: "var(--sh-muted)" }}>{st.hits}-{st.ab}{st.bb ? ` · ${st.bb}BB` : ""}</div>}
                          </div>
                        </div>
                      );
                    })()}
                    {inHoleBatter && (() => {
                      const st = playerStats(inHoleBatter.player.id);
                      return (
                        <div className="flex items-center gap-1.5 opacity-70">
                          <PlayerAvatar
                            player={inHoleBatter.player}
                            size={36}
                            onClick={inHoleBatter.player.photoUrl ? () => setEnlargedPhoto({ url: inHoleBatter.player.photoUrl!, name: inHoleBatter.player.name }) : undefined}
                          />
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: "var(--sh-muted)", fontSize: 9 }}>In the hole</div>
                            <div className="text-xs font-semibold" style={{ color: "var(--sh-text)" }}>
                              {inHoleBatter.player.name}
                              {inHoleBatter.player.jerseyNumber && <span className="ml-1 font-normal" style={dim}>#{inHoleBatter.player.jerseyNumber}</span>}
                            </div>
                            {st.ab > 0 && <div className="text-xs" style={{ color: "var(--sh-muted)" }}>{st.hits}-{st.ab}</div>}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold uppercase mb-0.5" style={dim}>Pitching</div>
                {activePitcher ? (() => {
                  const pst = playerStats(activePitcher.pitcher.id);
                  const pitchStat = `${pst.ab + pst.bb} BF · ${pst.k} K`;
                  return (
                    <div className="flex items-center justify-end gap-2">
                      <div className="text-right">
                        <div className="text-sm font-semibold" style={{ color: "var(--sh-secondary)" }}>
                          {activePitcher.pitcher.name}
                        </div>
                        {activePitcher.pitcher.jerseyNumber && (
                          <div className="text-xs" style={dim}>#{activePitcher.pitcher.jerseyNumber}</div>
                        )}
                        {(pst.ab + pst.bb) > 0 && (
                          <div className="text-xs mt-0.5" style={{ color: "var(--sh-muted)" }}>{pitchStat}</div>
                        )}
                      </div>
                      <PlayerAvatar
                        player={activePitcherFull ?? activePitcher.pitcher}
                        size={56}
                        onClick={(activePitcherFull?.photoUrl) ? () => setEnlargedPhoto({ url: activePitcherFull!.photoUrl!, name: activePitcherFull!.name }) : undefined}
                      />
                    </div>
                  );
                })() : (
                  <span className="text-xs" style={{ color: "var(--sh-danger)" }}>No pitcher</span>
                )}
              </div>
            </div>

            {/* Outcome buttons */}
            {canEdit && (
              <div className="space-y-1.5">
                {/* Row 1: reaches base */}
                <div className="grid grid-cols-6 gap-1.5">
                  {OUTCOMES_ROW1.map(({ key, label, color }) => (
                    <button
                      key={key}
                      onClick={() => recordAtBat(key)}
                      disabled={saving || !activePitcher || !currentBatter || currentOuts >= 3}
                      className="py-3 rounded-xl font-bold text-sm border transition-all hover:opacity-80 disabled:opacity-30"
                      style={{ borderColor: color, color, background: "transparent" }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {/* Row 2: outs + runner out */}
                <div className="grid grid-cols-5 gap-1.5">
                  {OUTCOMES_ROW2.map(({ key, label, color }) => {
                    const outsNeeded = key === "DOUBLE_PLAY" ? 2 : key === "TRIPLE_PLAY" ? 3 : 1;
                    const disabled = saving || !activePitcher || !currentBatter || currentOuts >= 3
                      || (key === "DOUBLE_PLAY" && currentOuts >= 2)
                      || (key === "TRIPLE_PLAY" && currentOuts >= 1);
                    return (
                      <button
                        key={key}
                        onClick={() => recordAtBat(key)}
                        disabled={disabled}
                        className="py-3 rounded-xl font-bold text-sm border transition-all hover:opacity-80 disabled:opacity-30"
                        style={{ borderColor: color, color, background: "transparent" }}
                        title={key === "DOUBLE_PLAY" ? `Needs ≤1 out (currently ${currentOuts})` : key === "TRIPLE_PLAY" ? `Needs 0 outs (currently ${currentOuts})` : undefined}
                      >
                        {label}
                      </button>
                    );
                  })}
                  <button
                    onClick={recordRunnerOut}
                    disabled={saving || !currentBatter || currentOuts >= 3}
                    className="py-3 rounded-xl font-bold text-sm border transition-all hover:opacity-80 disabled:opacity-30"
                    style={{ borderColor: "#ef4444", color: "#ef4444", background: "transparent" }}
                    title="Runner put out while batter's at-bat continues"
                  >
                    RO
                  </button>
                </div>
              </div>
            )}

            {/* Undo + pitcher change */}
            {canEdit && (
              <div className="flex gap-2 pt-1">
                <button
                  onClick={undoLastAtBat}
                  disabled={saving || (currentHalfABs.length === 0 && currentHalfROs.length === 0)}
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

      {/* Photo lightbox */}
      {enlargedPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.85)" }}
          onClick={() => setEnlargedPhoto(null)}
        >
          <img
            src={enlargedPhoto.url}
            alt={enlargedPhoto.name}
            className="rounded-2xl object-contain shadow-2xl"
            style={{ maxHeight: "80vh", maxWidth: "80vw" }}
            onClick={e => e.stopPropagation()}
          />
          <div className="absolute bottom-6 left-0 right-0 text-center">
            <span className="text-white font-semibold text-lg drop-shadow">{enlargedPhoto.name}</span>
          </div>
          <button
            onClick={() => setEnlargedPhoto(null)}
            className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center text-lg font-bold transition-opacity hover:opacity-80"
            style={{ background: "rgba(255,255,255,0.15)", color: "#fff" }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
