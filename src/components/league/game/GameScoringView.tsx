"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/context/language-context";
import { OfficialsSetup } from "./OfficialsSetup";
import { LineupEditor } from "./LineupEditor";
import { ManagerScorebook } from "./ManagerScorebook";
import { PlayerStatsTable } from "./PlayerStatsTable";
import { OfficialScorekeeper } from "./OfficialScorekeeper";
import { computeGameStats } from "@/lib/stats";
import { TeamAvatar } from "@/components/ui/TeamAvatar";

interface Player {
  id: string; name: string;
  jerseyNumber: string | null;
  nationality: string | null;
  photoUrl: string | null;
}
interface Official {
  id: string; role: string;
  user: { id: string; name: string | null; email: string };
}
interface LineupEntry {
  id: string; isHome: boolean; position: string; battingOrder: number | null;
  player: Player;
}
interface AtBat {
  id: string; inningNumber: number; isTop: boolean;
  batterId: string; pitcherId: string; outcome: string; sequence: number;
}
interface Inning {
  id: string; inningNumber: number; isTop: boolean; runsScored: number; completed: boolean;
}
interface PitcherStint {
  id: string; isHome: boolean;
  inningStart: number; isTopStart: boolean; outsAtStart: number;
  inningEnd: number | null; isTopEnd: boolean | null; outsAtEnd: number | null;
  pitcher: { id: string; name: string; jerseyNumber: string | null };
}
interface Game {
  id: string; status: string; scheduledAt: string;
  homeAwayTbd: boolean; homeScore: number | null; awayScore: number | null;
  fieldId: string | null;
  field: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
  homeTeam: { id: string; name: string; logoUrl?: string | null; players: Player[] };
  awayTeam: { id: string; name: string; logoUrl?: string | null; players: Player[] };
  officials: Official[];
  lineups: LineupEntry[];
  atBats: AtBat[];
  innings: Inning[];
  pitcherStints: PitcherStint[];
}
interface FieldOption { id: string; name: string }
interface UserOption { id: string; name: string | null; email: string }
interface Permissions {
  canEditOfficials: boolean;
  canStartGame: boolean;
  canEditHomeLineup: boolean;
  canEditAwayLineup: boolean;
  canSwapTeams: boolean;
  canEditHomeScorebook: boolean;
  canEditAwayScorebook: boolean;
  canScore: boolean;
}

type OffenseResult = "" | "OUT" | "K" | "1B" | "2B" | "3B" | "HR";
interface ScoreBookData {
  offense:   Record<string, Record<string, OffenseResult>>;
  defense:   Record<string, { outs: number; k: number }>;
  runs:      Record<string, number>;
  rivalRuns: Record<string, number>;
}

interface Props {
  slug: string;
  seasonId: string;
  game: Game;
  fields: FieldOption[];
  umpireOptions: UserOption[];
  scorerOptions: UserOption[];
  permissions: Permissions;
  homeScorebook: ScoreBookData | null;
  awayScorebook: ScoreBookData | null;
}

type Tab = "setup" | "home" | "away" | "official" | "home-book" | "away-book" | "home-stats" | "away-stats";

function isLineupComplete(lineups: LineupEntry[], isHome: boolean): boolean {
  const active = lineups.filter(l => l.isHome === isHome && l.position !== "B");
  if (active.length < 9) return false;
  const orders = active.map(l => l.battingOrder!).filter(Boolean).sort((a, b) => a - b);
  if (orders.length < 9) return false;
  for (let i = 0; i < orders.length; i++) {
    if (orders[i] !== i + 1) return false;
  }
  return true;
}

export function GameScoringView({ slug, seasonId, game, fields, umpireOptions, scorerOptions, permissions, homeScorebook, awayScorebook }: Props) {
  const router = useRouter();
  const { t } = useLanguage();
  const ts = t.scoring;
  const [tab, setTab] = useState<Tab>("setup");
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");
  const [showEndModal, setShowEndModal] = useState(false);
  const [ending, setEnding] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [endError, setEndError] = useState("");

  const card = { borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" };

  const umpires = game.officials.filter(o => o.role === "UMPIRE");
  const scorer  = game.officials.find(o => o.role === "SCOREKEEPER");

  const homeComplete = isLineupComplete(game.lineups, true);
  const awayComplete = isLineupComplete(game.lineups, false);
  const officialsComplete = umpires.length >= 1 && !!scorer;
  const canStart = permissions.canStartGame && game.status === "SCHEDULED" && officialsComplete && homeComplete && awayComplete;

  async function handleStartGame() {
    setStarting(true);
    setStartError("");
    const res = await fetch(`/api/leagues/${slug}/games/${game.id}/start`, { method: "POST" });
    setStarting(false);
    if (!res.ok) {
      const data = await res.json();
      setStartError(data.error ?? ts.errorStartGame);
      return;
    }
    router.refresh();
  }

  async function handleEndGame(outcome: "official" | "cancelled") {
    setEnding(true);
    setEndError("");
    const res = await fetch(`/api/leagues/${slug}/games/${game.id}/end`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome, cancelReason: cancelReason.trim() }),
    });
    setEnding(false);
    if (!res.ok) {
      const data = await res.json();
      setEndError(data.error ?? "Something went wrong");
      return;
    }
    setShowEndModal(false);
    router.refresh();
  }

  const canEnd = permissions.canStartGame && game.status === "IN_PROGRESS";

  const statusColor = game.status === "IN_PROGRESS" ? "var(--sh-warn)" :
                      game.status === "COMPLETED"    ? "var(--sh-muted)" : "var(--sh-primary)";
  const statusText  = game.status === "IN_PROGRESS" ? ts.statusInProgress :
                      game.status === "COMPLETED"    ? "Completed" : ts.statusScheduled;

  const date = new Date(game.scheduledAt);

  const gameActive = game.status === "IN_PROGRESS" || game.status === "COMPLETED";
  const showHomeScorebookTab = gameActive || (game.status === "SCHEDULED" && homeComplete);
  const showAwayScorebookTab = gameActive || (game.status === "SCHEDULED" && awayComplete);

  const showOfficialTab = permissions.canScore && gameActive;

  const tabs: { key: Tab; label: string; indicator?: boolean }[] = [
    { key: "setup", label: ts.setup, indicator: officialsComplete },
    { key: "home",  label: `${ts.homeLineup}`, indicator: homeComplete },
    { key: "away",  label: `${ts.awayLineup}`, indicator: awayComplete },
    ...(showOfficialTab ? [{ key: "official" as Tab, label: "⚾ Score" }] : []),
    ...(showHomeScorebookTab ? [
      { key: "home-book"   as Tab, label: `📓 ${game.homeTeam.name}` },
      { key: "home-stats"  as Tab, label: `📊 ${game.homeTeam.name}` },
    ] : []),
    ...(showAwayScorebookTab ? [
      { key: "away-book"   as Tab, label: `📓 ${game.awayTeam.name}` },
      { key: "away-stats"  as Tab, label: `📊 ${game.awayTeam.name}` },
    ] : []),
  ];

  // Build batter rows from lineups (sorted by battingOrder)
  const homeBatters = game.lineups
    .filter(l => l.isHome && l.battingOrder != null && l.position !== "B")
    .sort((a, b) => a.battingOrder! - b.battingOrder!)
    .map(l => ({ playerId: l.player.id, battingOrder: l.battingOrder!, name: l.player.name, jerseyNumber: l.player.jerseyNumber, photoUrl: l.player.photoUrl, nationality: l.player.nationality }));

  const awayBatters = game.lineups
    .filter(l => !l.isHome && l.battingOrder != null && l.position !== "B")
    .sort((a, b) => a.battingOrder! - b.battingOrder!)
    .map(l => ({ playerId: l.player.id, battingOrder: l.battingOrder!, name: l.player.name, jerseyNumber: l.player.jerseyNumber, photoUrl: l.player.photoUrl, nationality: l.player.nationality }));

  return (
    <div className="space-y-6">
      {/* Game header card */}
      <div className="rounded-2xl border p-5" style={card}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <TeamAvatar name={game.homeTeam.name} logoUrl={game.homeTeam.logoUrl} size={10} />
              <h1 className="text-xl font-bold" style={{ color: "var(--sh-text)" }}>
                {game.homeTeam.name}
                <span className="mx-2 font-normal text-sm" style={{ color: "var(--sh-muted)" }}>vs</span>
                {game.awayTeam.name}
              </h1>
              <TeamAvatar name={game.awayTeam.name} logoUrl={game.awayTeam.logoUrl} size={10} />
              <span className="text-xs font-semibold rounded-full px-2.5 py-0.5" style={{ background: "var(--sh-bg-card2)", color: statusColor }}>
                {statusText}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-2 flex-wrap text-sm" style={{ color: "var(--sh-muted)" }}>
              <span>📅 {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              {game.field && <span>🏟️ {game.field.name}</span>}
              {game.category && <span>📂 {game.category.name}</span>}
            </div>
          </div>

          {/* Start Game */}
          {game.status === "SCHEDULED" && permissions.canStartGame && (
            <div className="flex flex-col items-end gap-1">
              <button
                onClick={handleStartGame}
                disabled={!canStart || starting}
                className="px-5 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: canStart ? "linear-gradient(135deg,#16a34a,#15803d)" : "var(--sh-bg-card2)",
                  color: canStart ? "#fff" : "var(--sh-muted)",
                  boxShadow: canStart ? "0 0 20px rgba(74,222,128,0.3)" : "none",
                }}
              >
                {starting ? "Starting…" : ts.startGame}
              </button>
              {startError && <p className="text-xs" style={{ color: "var(--sh-danger)" }}>{startError}</p>}
              {!canStart && (
                <div className="text-xs text-right space-y-0.5" style={{ color: "var(--sh-muted)" }}>
                  <p style={{ color: "var(--sh-text)", fontWeight: 600 }}>{ts.startRequirements}</p>
                  <p style={{ color: officialsComplete ? "var(--sh-primary)" : "var(--sh-danger)" }}>
                    {officialsComplete ? "✓" : "✗"} {ts.reqUmpire}
                  </p>
                  <p style={{ color: !!scorer ? "var(--sh-primary)" : "var(--sh-danger)" }}>
                    {scorer ? "✓" : "✗"} {ts.reqScorekeeper}
                  </p>
                  <p style={{ color: homeComplete ? "var(--sh-primary)" : "var(--sh-danger)" }}>
                    {homeComplete ? "✓" : "✗"} {ts.reqHomeLineup}
                  </p>
                  <p style={{ color: awayComplete ? "var(--sh-primary)" : "var(--sh-danger)" }}>
                    {awayComplete ? "✓" : "✗"} {ts.reqAwayLineup}
                  </p>
                </div>
              )}
            </div>
          )}

          {game.status === "IN_PROGRESS" && (
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black animate-pulse" style={{ color: "var(--sh-warn)" }}>● LIVE</span>
                <Link
                  href={`/game/${game.id}/live`}
                  target="_blank"
                  className="text-xs px-2.5 py-1 rounded-lg border transition-opacity hover:opacity-80"
                  style={{ borderColor: "var(--sh-border2)", color: "var(--sh-primary)" }}
                >
                  Public view ↗
                </Link>
              </div>
              {canEnd && (
                <button
                  onClick={() => { setShowEndModal(true); setEndError(""); setCancelReason(""); }}
                  className="text-xs px-3 py-1.5 rounded-lg border font-semibold transition-opacity hover:opacity-80"
                  style={{ borderColor: "var(--sh-danger-border)", color: "var(--sh-danger)", background: "transparent" }}
                >
                  End Game
                </button>
              )}
            </div>
          )}

          {game.status === "COMPLETED" && (
            <Link
              href={`/game/${game.id}/live`}
              target="_blank"
              className="text-xs px-2.5 py-1 rounded-lg border transition-opacity hover:opacity-80"
              style={{ borderColor: "var(--sh-border2)", color: "var(--sh-muted)" }}
            >
              Game summary ↗
            </Link>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl p-1" style={{ background: "var(--sh-bg-card)", border: "1px solid var(--sh-border)" }}>
        {tabs.map(tb => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1.5"
            style={tab === tb.key
              ? { background: "var(--sh-primary-dark)", color: "#fff" }
              : { color: "var(--sh-primary)", background: "transparent" }}
          >
            {tb.label}
            {tb.indicator !== undefined && (
              <span className="text-xs" style={{ color: tab === tb.key ? "rgba(255,255,255,0.8)" : tb.indicator ? "var(--sh-primary)" : "var(--sh-danger)" }}>
                {tb.indicator ? "✓" : "○"}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "official" && showOfficialTab && (
        <OfficialScorekeeper
          slug={slug}
          gameId={game.id}
          homeTeam={game.homeTeam}
          awayTeam={game.awayTeam}
          homeLineup={game.lineups.filter(l => l.isHome && l.battingOrder != null && l.position !== "B").sort((a, b) => a.battingOrder! - b.battingOrder!)}
          awayLineup={game.lineups.filter(l => !l.isHome && l.battingOrder != null && l.position !== "B").sort((a, b) => a.battingOrder! - b.battingOrder!)}
          initialAtBats={game.atBats}
          initialInnings={game.innings}
          initialPitcherStints={game.pitcherStints}
          canEdit={game.status === "IN_PROGRESS" && permissions.canScore}
        />
      )}

      {tab === "setup" && (
        <OfficialsSetup
          slug={slug}
          gameId={game.id}
          homeTeam={game.homeTeam}
          awayTeam={game.awayTeam}
          homeAwayTbd={game.homeAwayTbd}
          canSwapTeams={permissions.canSwapTeams}
          gameStatus={game.status}
          fields={fields}
          umpireOptions={umpireOptions}
          scorerOptions={scorerOptions}
          initialFieldId={game.fieldId}
          initialUmpireIds={umpires.map(o => o.user.id)}
          initialScorekeeperId={scorer?.user.id ?? null}
          canEdit={permissions.canEditOfficials}
        />
      )}

      {tab === "home" && (
        <LineupEditor
          key={`home-${game.lineups.filter(l => l.isHome).map(l => l.id).join()}`}
          slug={slug}
          gameId={game.id}
          isHome={true}
          teamName={game.homeTeam.name}
          teamLogoUrl={game.homeTeam.logoUrl}
          players={game.homeTeam.players}
          initialEntries={game.lineups.filter(l => l.isHome).map(l => ({
            playerId: l.player.id,
            position: l.position,
            battingOrder: l.battingOrder,
          }))}
          canEdit={permissions.canEditHomeLineup}
        />
      )}

      {tab === "away" && (
        <LineupEditor
          key={`away-${game.lineups.filter(l => !l.isHome).map(l => l.id).join()}`}
          slug={slug}
          gameId={game.id}
          isHome={false}
          teamName={game.awayTeam.name}
          teamLogoUrl={game.awayTeam.logoUrl}
          players={game.awayTeam.players}
          initialEntries={game.lineups.filter(l => !l.isHome).map(l => ({
            playerId: l.player.id,
            position: l.position,
            battingOrder: l.battingOrder,
          }))}
          canEdit={permissions.canEditAwayLineup}
        />
      )}

      {tab === "home-book" && showHomeScorebookTab && (
        <ManagerScorebook
          slug={slug}
          gameId={game.id}
          teamId={game.homeTeam.id}
          teamName={game.homeTeam.name}
          opponentName={game.awayTeam.name}
          lineup={homeBatters}
          canEdit={permissions.canEditHomeScorebook}
          isHome={true}
          initialData={homeScorebook}
        />
      )}

      {tab === "away-book" && showAwayScorebookTab && (
        <ManagerScorebook
          slug={slug}
          gameId={game.id}
          teamId={game.awayTeam.id}
          teamName={game.awayTeam.name}
          opponentName={game.homeTeam.name}
          lineup={awayBatters}
          canEdit={permissions.canEditAwayScorebook}
          isHome={false}
          initialData={awayScorebook}
        />
      )}

      {tab === "home-stats" && showHomeScorebookTab && (
        <PlayerStatsTable
          stats={computeGameStats(homeScorebook?.offense as Record<string, Record<string, string>> ?? null, homeBatters)}
          teamName={game.homeTeam.name}
          label="Game Stats"
        />
      )}

      {tab === "away-stats" && showAwayScorebookTab && (
        <PlayerStatsTable
          stats={computeGameStats(awayScorebook?.offense as Record<string, Record<string, string>> ?? null, awayBatters)}
          teamName={game.awayTeam.name}
          label="Game Stats"
        />
      )}

      {/* ── End Game Modal ── */}
      {showEndModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="w-full max-w-sm rounded-2xl border p-6 space-y-4" style={{ background: "var(--sh-bg-card)", borderColor: "var(--sh-border)" }}>
            <h2 className="text-lg font-bold" style={{ color: "var(--sh-text)" }}>End Game</h2>
            <p className="text-sm" style={{ color: "var(--sh-muted)" }}>How did this game end?</p>

            <div className="space-y-2">
              <button
                onClick={() => handleEndGame("official")}
                disabled={ending}
                className="w-full py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#16a34a,#15803d)", color: "#fff" }}
              >
                ✓ Official — game completed
              </button>

              <div className="space-y-1.5">
                <textarea
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  placeholder="Cancellation reason (required)…"
                  rows={2}
                  className="w-full rounded-lg border px-3 py-2 text-sm resize-none outline-none"
                  style={{ background: "var(--sh-bg-card2)", borderColor: "var(--sh-border)", color: "var(--sh-text)" }}
                />
                <button
                  onClick={() => handleEndGame("cancelled")}
                  disabled={ending || !cancelReason.trim()}
                  className="w-full py-2 rounded-xl font-semibold text-sm transition-all disabled:opacity-40"
                  style={{ borderColor: "var(--sh-danger-border)", color: "var(--sh-danger)", background: "transparent", border: "1px solid" }}
                >
                  ✗ Cancel game
                </button>
              </div>
            </div>

            {endError && <p className="text-xs" style={{ color: "var(--sh-danger)" }}>{endError}</p>}

            <button
              onClick={() => setShowEndModal(false)}
              className="w-full text-sm py-1.5 rounded-lg transition-opacity hover:opacity-70"
              style={{ color: "var(--sh-muted)" }}
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
