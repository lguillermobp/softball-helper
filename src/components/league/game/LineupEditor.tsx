"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/context/language-context";

const UNIQUE_POSITIONS = ["P", "C", "1B", "2B", "3B", "SS", "SF", "LF", "CF", "RF", "DH"];
const ALL_POSITIONS = [...UNIQUE_POSITIONS, "EH", "B"];

interface Player {
  id: string; name: string;
  jerseyNumber: string | null;
  photoUrl: string | null;
}

interface LineupRow {
  playerId: string;
  position: string;       // "" = not in lineup
  battingOrder: number | null;
}

interface Props {
  slug: string;
  gameId: string;
  isHome: boolean;
  teamName: string;
  players: Player[];
  initialEntries: { playerId: string; position: string; battingOrder: number | null }[];
  canEdit: boolean;
}

function initRows(players: Player[], entries: Props["initialEntries"]): LineupRow[] {
  return players.map(p => {
    const e = entries.find(x => x.playerId === p.id);
    return { playerId: p.id, position: e?.position ?? "", battingOrder: e?.battingOrder ?? null };
  });
}

export function LineupEditor({ slug, gameId, isHome, teamName, players, initialEntries, canEdit }: Props) {
  const router = useRouter();
  const { t } = useLanguage();
  const ts = t.scoring;

  const [rows, setRows] = useState<LineupRow[]>(() => initRows(players, initialEntries));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const card  = { borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" };

  // Compute taken unique positions (for disabling in dropdowns)
  function takenUniquePos(excludeId: string): string[] {
    return rows
      .filter(r => r.playerId !== excludeId && UNIQUE_POSITIONS.includes(r.position))
      .map(r => r.position);
  }

  function getNextBattingOrder(excludeId?: string): number {
    const used = rows.filter(r => r.playerId !== excludeId && r.battingOrder !== null).map(r => r.battingOrder!);
    let n = 1;
    while (used.includes(n)) n++;
    return n;
  }

  function updatePosition(playerId: string, position: string) {
    setRows(prev => prev.map(r => {
      if (r.playerId !== playerId) return r;
      const newBo = position === "" || position === "B"
        ? null
        : r.battingOrder ?? getNextBattingOrder(playerId);
      return { ...r, position, battingOrder: newBo };
    }));
  }

  function updateBattingOrder(playerId: string, value: string) {
    const n = value === "" ? null : parseInt(value, 10);
    setRows(prev => prev.map(r => r.playerId === playerId ? { ...r, battingOrder: isNaN(n as number) ? null : n } : r));
  }

  function autoNumber() {
    setRows(prev => {
      // Collect active (non-B, non-empty) rows in current order; re-assign 1..N
      let counter = 1;
      return prev.map(r => {
        if (r.position === "" || r.position === "B") return { ...r, battingOrder: null };
        return { ...r, battingOrder: counter++ };
      });
    });
  }

  // Validation
  const active = rows.filter(r => r.position && r.position !== "B");
  const batters = active.filter(r => r.battingOrder !== null);
  const orders  = batters.map(r => r.battingOrder!).sort((a, b) => a - b);

  const dupPositions: string[] = [];
  const posCounts: Record<string, number> = {};
  active.forEach(r => {
    if (UNIQUE_POSITIONS.includes(r.position)) {
      posCounts[r.position] = (posCounts[r.position] ?? 0) + 1;
      if (posCounts[r.position] > 1 && !dupPositions.includes(r.position)) dupPositions.push(r.position);
    }
  });

  const hasDupPos   = dupPositions.length > 0;
  const hasOrderGap = orders.some((o, i) => o !== i + 1);
  const hasDupOrder = new Set(orders).size !== orders.length;
  const tooFew      = batters.length < 9;
  const isComplete  = !tooFew && !hasDupPos && !hasOrderGap && !hasDupOrder;

  async function handleSave() {
    setSaving(true); setError(""); setSaved(false);
    const entries = rows
      .filter(r => r.position !== "")
      .map(r => ({ playerId: r.playerId, position: r.position, battingOrder: r.battingOrder }));

    const res = await fetch(`/api/leagues/${slug}/games/${gameId}/lineup`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isHome, entries }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? ts.errorSaveLineup);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  const playerMap = Object.fromEntries(players.map(p => [p.id, p]));

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ color: "var(--sh-text)" }}>
            {isHome ? "🏠" : "✈️"} {teamName}
          </h2>
          <p className="text-xs mt-0.5" style={{ color: isComplete ? "var(--sh-primary)" : "var(--sh-muted)" }}>
            {batters.length} {batters.length === 1 ? "batter" : "batters"} ·{" "}
            <span style={{ color: isComplete ? "var(--sh-primary)" : "var(--sh-danger)", fontWeight: 600 }}>
              {isComplete ? `✓ ${ts.lineupComplete}` : `○ ${ts.lineupIncomplete}`}
            </span>
          </p>
        </div>
        {canEdit && (
          <button
            onClick={autoNumber}
            className="text-xs px-3 py-1.5 rounded-lg border transition-colors hover:opacity-80"
            style={{ borderColor: "var(--sh-border2)", color: "var(--sh-primary)", background: "transparent" }}
          >
            {ts.autoOrder}
          </button>
        )}
      </div>

      {/* Validation warnings */}
      {canEdit && (hasDupPos || hasOrderGap || hasDupOrder || tooFew) && (
        <div className="rounded-xl border px-4 py-3 space-y-1 text-xs" style={{ borderColor: "var(--sh-danger-border)", background: "var(--sh-danger-bg)" }}>
          {tooFew      && <p style={{ color: "var(--sh-danger)" }}>✗ {ts.minBatters}</p>}
          {hasDupPos   && <p style={{ color: "var(--sh-danger)" }}>✗ {ts.dupPosition}: {dupPositions.join(", ")}</p>}
          {(hasOrderGap || hasDupOrder) && <p style={{ color: "var(--sh-danger)" }}>✗ {ts.orderGap}</p>}
        </div>
      )}

      {!canEdit && (
        <div className="rounded-xl border px-4 py-3 text-sm" style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card2)", color: "var(--sh-muted)" }}>
          {ts.readOnly}
        </div>
      )}

      {/* Player table */}
      <div className="rounded-2xl border overflow-hidden" style={card}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--sh-border)", background: "var(--sh-bg-card2)" }}>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--sh-muted)" }}>{ts.player}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider w-36" style={{ color: "var(--sh-muted)" }}>{ts.position}</th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider w-20" style={{ color: "var(--sh-muted)" }}>{ts.battingOrder}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const player = playerMap[row.playerId];
              if (!player) return null;
              const taken  = takenUniquePos(row.playerId);
              const isActive = row.position && row.position !== "B" && row.position !== "";
              const isDupPos = UNIQUE_POSITIONS.includes(row.position) && (posCounts[row.position] ?? 0) > 1;
              const isDupOrd = row.battingOrder !== null &&
                rows.filter(r => r.battingOrder === row.battingOrder && r.playerId !== row.playerId).length > 0;

              return (
                <tr
                  key={row.playerId}
                  style={{
                    borderBottom: "1px solid var(--sh-border)",
                    background: isDupPos || isDupOrd ? "var(--sh-danger-bg)" : "transparent",
                  }}
                >
                  {/* Player info */}
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      {player.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={player.photoUrl} alt={player.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: "var(--sh-bg-card2)", color: "var(--sh-primary)" }}>
                          {player.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-medium" style={{ color: "var(--sh-text)" }}>{player.name}</p>
                        {player.jerseyNumber && <p className="text-xs" style={{ color: "var(--sh-muted)" }}>#{player.jerseyNumber}</p>}
                      </div>
                    </div>
                  </td>

                  {/* Position */}
                  <td className="px-4 py-2.5">
                    {canEdit ? (
                      <select
                        value={row.position}
                        onChange={e => updatePosition(row.playerId, e.target.value)}
                        className="w-full rounded-md border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        style={{ borderColor: isDupPos ? "var(--sh-danger)" : "var(--sh-border)" }}
                      >
                        <option value="">{ts.notPlaying}</option>
                        {ALL_POSITIONS.map(pos => (
                          <option
                            key={pos}
                            value={pos}
                            disabled={UNIQUE_POSITIONS.includes(pos) && taken.includes(pos)}
                          >
                            {pos}{pos === "B" ? " (Sub)" : ""}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-sm font-semibold" style={{ color: row.position ? "var(--sh-primary)" : "var(--sh-muted)" }}>
                        {row.position || "—"}
                      </span>
                    )}
                  </td>

                  {/* Batting order */}
                  <td className="px-4 py-2.5 text-center">
                    {isActive ? (
                      canEdit ? (
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={row.battingOrder ?? ""}
                          onChange={e => updateBattingOrder(row.playerId, e.target.value)}
                          className="w-14 text-center rounded-md border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                          style={{ borderColor: isDupOrd ? "var(--sh-danger)" : "var(--sh-border)" }}
                        />
                      ) : (
                        <span className="font-bold" style={{ color: isDupOrd ? "var(--sh-danger)" : "var(--sh-text)" }}>
                          {row.battingOrder ?? "—"}
                        </span>
                      )
                    ) : (
                      <span style={{ color: "var(--sh-muted)" }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Save button */}
      {canEdit && (
        <div className="flex items-center justify-end gap-3">
          {saved && <span className="text-sm" style={{ color: "var(--sh-primary)" }}>✓ Saved</span>}
          {error && <span className="text-sm" style={{ color: "var(--sh-danger)" }}>{error}</span>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#16a34a,#15803d)", color: "#fff" }}
          >
            {saving ? "Saving…" : ts.saveLineup}
          </button>
        </div>
      )}
    </div>
  );
}
