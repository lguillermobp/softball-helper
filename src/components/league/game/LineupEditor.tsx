"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/context/language-context";
import { TeamAvatar } from "@/components/ui/TeamAvatar";
import { flagUrl } from "@/lib/countries";

const UNIQUE_POSITIONS = ["P", "C", "1B", "2B", "3B", "SS", "SF", "LF", "CF", "RF", "DH"];
const ALL_POSITIONS = [...UNIQUE_POSITIONS, "EH", "B"];

interface Player {
  id: string; name: string;
  jerseyNumber: string | null;
  nationality: string | null;
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
  teamLogoUrl?: string | null;
  players: Player[];
  initialEntries: { playerId: string; position: string; battingOrder: number | null }[];
  canEdit: boolean;
}

function initRows(players: Player[], entries: Props["initialEntries"]): LineupRow[] {
  const rows = [...players]
    .sort((a, b) => {
      const na = parseInt(a.jerseyNumber ?? "", 10);
      const nb = parseInt(b.jerseyNumber ?? "", 10);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      if (!isNaN(na)) return -1;
      if (!isNaN(nb)) return  1;
      return a.name.localeCompare(b.name);
    })
    .map(p => {
      const e = entries.find(x => x.playerId === p.id);
      return { playerId: p.id, position: e?.position ?? "", battingOrder: e?.battingOrder ?? null };
    });

  // If the lineup already has batting orders saved, show them in that order
  const hasSavedOrder = rows.some(r => r.battingOrder !== null);
  if (hasSavedOrder) {
    rows.sort((a, b) => {
      if (a.battingOrder !== null && b.battingOrder !== null) return a.battingOrder - b.battingOrder;
      if (a.battingOrder !== null) return -1;
      if (b.battingOrder !== null) return  1;
      return 0;
    });
  }

  return rows;
}

export function LineupEditor({ slug, gameId, isHome, teamName, teamLogoUrl, players, initialEntries, canEdit }: Props) {
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
    // Re-sort by batting order so the lineup reads top-to-bottom
    setRows(prev => [...prev].sort((a, b) => {
      if (a.battingOrder !== null && b.battingOrder !== null) return a.battingOrder - b.battingOrder;
      if (a.battingOrder !== null) return -1;
      if (b.battingOrder !== null) return  1;
      return 0; // keep jersey-number order for unassigned players
    }));
    router.refresh();
  }

  const playerMap = Object.fromEntries(players.map(p => [p.id, p]));

  // ── Lineup card (printable field diagram) ──────────────────────────────────
  function printLineupCard() {
    const FIELD_POS = new Set(["P","C","1B","2B","3B","SS","LF","CF","RF","SF"]);

    const batters = rows
      .filter(r => r.position && r.position !== "B" && r.battingOrder !== null)
      .sort((a, b) => a.battingOrder! - b.battingOrder!);
    const noBatOrder = rows.filter(r => r.position && r.position !== "B" && r.position !== "" && r.battingOrder === null);
    const bench      = rows.filter(r => !r.position || r.position === "" || r.position === "B");
    const onField    = rows.filter(r => FIELD_POS.has(r.position));

    // Position coordinates in 500×510 SVG
    const POS_XY: Record<string, [number, number]> = {
      C:    [250, 455],
      P:    [250, 330],
      "1B": [390, 315],
      "2B": [322, 240],
      SS:   [178, 240],
      "3B": [110, 315],
      LF:   [ 95, 135],
      CF:   [250,  82],
      RF:   [405, 135],
      SF:   [250, 178],
    };

    function avatar(row: LineupRow, cx: number, cy: number, r: number, idx: number): string {
      const p  = playerMap[row.playerId];
      const nm = p?.name ?? "";
      const short = nm.length > 12 ? nm.split(" ")[0] : nm;
      const jr = p?.jerseyNumber ? `#${p.jerseyNumber}` : "";
      const cid = `pc${idx}`;
      if (p?.photoUrl) {
        return `<g>
          <defs><clipPath id="${cid}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath></defs>
          <circle cx="${cx}" cy="${cy}" r="${r+3}" fill="white"/>
          <image href="${p.photoUrl}" x="${cx-r}" y="${cy-r}" width="${r*2}" height="${r*2}" clip-path="url(#${cid})" preserveAspectRatio="xMidYMid slice"/>
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="white" stroke-width="2.5"/>
          <text x="${cx}" y="${cy+r+14}" text-anchor="middle" font-size="10" font-weight="700" fill="#111" font-family="sans-serif">${short}</text>
          <text x="${cx}" y="${cy+r+25}" text-anchor="middle" font-size="9" fill="#555" font-family="sans-serif">${jr}</text>
        </g>`;
      }
      const init = nm.charAt(0).toUpperCase() || "?";
      return `<g>
        <circle cx="${cx}" cy="${cy}" r="${r+3}" fill="white"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="#166534"/>
        <text x="${cx}" y="${cy+r*0.38}" text-anchor="middle" font-size="${Math.round(r*0.85)}" font-weight="800" fill="#4ade80" font-family="sans-serif">${init}</text>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="white" stroke-width="2.5"/>
        <text x="${cx}" y="${cy+r+14}" text-anchor="middle" font-size="10" font-weight="700" fill="#111" font-family="sans-serif">${short}</text>
        <text x="${cx}" y="${cy+r+25}" text-anchor="middle" font-size="9" fill="#555" font-family="sans-serif">${jr}</text>
      </g>`;
    }

    const posEls = onField.map((row, i) => {
      const xy = POS_XY[row.position];
      if (!xy) return "";
      return `<g>
        <text x="${xy[0]}" y="${xy[1]-32}" text-anchor="middle" font-size="9" font-weight="900"
          fill="white" font-family="sans-serif"
          style="paint-order:stroke" stroke="#166534" stroke-width="3">${row.position}</text>
        ${avatar(row, xy[0], xy[1], 27, i)}
      </g>`;
    }).join("");

    const fieldSvg = `
<svg viewBox="0 0 500 510" xmlns="http://www.w3.org/2000/svg" width="100%">
  <!-- foul territory -->
  <rect width="500" height="510" fill="#f0fdf4"/>
  <!-- fair territory outer -->
  <path d="M 250,472 L 8,58 Q 250,-28 492,58 Z" fill="#22c55e" opacity="0.8"/>
  <!-- outfield shade -->
  <path d="M 250,472 L 55,100 Q 250,18 445,100 Z" fill="#16a34a" opacity="0.75"/>
  <!-- infield dirt -->
  <circle cx="250" cy="338" r="148" fill="#d97706" opacity="0.72"/>
  <!-- infield grass -->
  <polygon points="250,470 372,348 250,226 128,348" fill="#16a34a" opacity="0.8"/>
  <!-- baselines -->
  <line x1="250" y1="470" x2="372" y2="348" stroke="white" stroke-width="2.5" opacity="0.9"/>
  <line x1="372" y1="348" x2="250" y2="226" stroke="white" stroke-width="2.5" opacity="0.9"/>
  <line x1="250" y1="226" x2="128" y2="348" stroke="white" stroke-width="2.5" opacity="0.9"/>
  <line x1="128" y1="348" x2="250" y2="470" stroke="white" stroke-width="2.5" opacity="0.9"/>
  <!-- foul lines (dashed) -->
  <line x1="250" y1="470" x2="8" y2="58" stroke="white" stroke-width="1.5" opacity="0.45" stroke-dasharray="6,4"/>
  <line x1="250" y1="470" x2="492" y2="58" stroke="white" stroke-width="1.5" opacity="0.45" stroke-dasharray="6,4"/>
  <!-- outfield fence -->
  <path d="M 8,58 Q 250,-28 492,58" fill="none" stroke="white" stroke-width="3" opacity="0.65"/>
  <!-- pitcher circle -->
  <circle cx="250" cy="338" r="22" fill="#b45309" opacity="0.6" stroke="#92400e" stroke-width="1.5"/>
  <circle cx="250" cy="338" r="5" fill="#78350f"/>
  <!-- bases -->
  <rect x="360" y="336" width="14" height="14" fill="white" transform="rotate(45 367 343)" rx="1"/>
  <rect x="238" y="214" width="14" height="14" fill="white" transform="rotate(45 245 221)" rx="1"/>
  <rect x="116" y="336" width="14" height="14" fill="white" transform="rotate(45 123 343)" rx="1"/>
  <!-- home plate -->
  <polygon points="250,483 264,472 264,459 236,459 236,472" fill="white"/>
  <!-- players -->
  ${posEls}
</svg>`;

    function playerRow(row: LineupRow, showBat: boolean): string {
      const p  = playerMap[row.playerId];
      const nm = p?.name ?? "—";
      const jr = p?.jerseyNumber ? `#${p.jerseyNumber}` : "";
      const ph = p?.photoUrl
        ? `<img src="${p.photoUrl}" style="width:34px;height:34px;border-radius:50%;object-fit:cover;border:2px solid #d1fae5;flex-shrink:0;"/>`
        : `<div style="width:34px;height:34px;border-radius:50%;background:#166534;color:#4ade80;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;flex-shrink:0;">${nm.charAt(0).toUpperCase()}</div>`;
      return `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #e5e7eb;">
        ${showBat ? `<span style="font-size:15px;font-weight:900;color:#16a34a;min-width:20px;text-align:right;">${row.battingOrder ?? "—"}</span>` : ""}
        ${ph}
        <div style="min-width:0;overflow:hidden;">
          <div style="font-size:11px;font-weight:700;color:#111;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${nm}</div>
          <div style="font-size:10px;color:#6b7280;">${jr}${row.position ? ` · ${row.position}` : ""}</div>
        </div>
      </div>`;
    }

    const battingHtml = [...batters, ...noBatOrder].map(r => playerRow(r, true)).join("") ||
      `<p style="font-size:10px;color:#9ca3af;font-style:italic;">No batters assigned</p>`;

    const benchHtml = bench.length === 0
      ? `<p style="font-size:10px;color:#9ca3af;font-style:italic;">—</p>`
      : bench.map(r => playerRow(r, false)).join("");

    const warning = !isComplete
      ? `<div style="background:#fef3c7;border:2px solid #f59e0b;border-radius:6px;padding:6px 12px;margin-bottom:10px;font-size:11px;color:#92400e;font-weight:600;text-align:center;">
           ⚠ Lineup incomplete — this card may not reflect the final lineup
         </div>`
      : "";

    const html = `<!DOCTYPE html><html><head>
<meta charset="utf-8"><title>${teamName} — Lineup Card</title>
<style>
  @page{size:letter landscape;margin:8mm 10mm;}
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:-apple-system,sans-serif;color:#111;background:#fff;}
  .grid{display:grid;grid-template-columns:195px 1fr 155px;gap:16px;align-items:start;}
  .label{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:#16a34a;border-bottom:2px solid #16a34a;padding-bottom:3px;margin-bottom:8px;}
  @media print{.no-print{display:none!important;}body{print-color-adjust:exact;-webkit-print-color-adjust:exact;}}
</style>
</head><body>
<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0 8px;border-bottom:3px solid #16a34a;margin-bottom:10px;">
  <div>
    <div style="font-size:20px;font-weight:900;">${teamName}</div>
    <div style="font-size:11px;color:#6b7280;margin-top:1px;">${isHome ? "🏠 Home" : "✈️ Away"} · Lineup Card</div>
  </div>
  <button class="no-print" onclick="window.print()" style="padding:6px 18px;background:#16a34a;color:white;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;">🖨 Print</button>
</div>
${warning}
<div class="grid">
  <div><div class="label">Batting Order</div>${battingHtml}</div>
  <div>${fieldSvg}</div>
  <div><div class="label">Bench</div>${benchHtml}</div>
</div>
</body></html>`;

    const w = window.open("", "_blank", "width=1120,height=800");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: "var(--sh-text)" }}>
            <TeamAvatar name={teamName} logoUrl={teamLogoUrl} size={8} />
            {isHome ? "🏠" : "✈️"} {teamName}
          </h2>
          <p className="text-xs mt-0.5" style={{ color: isComplete ? "var(--sh-primary)" : "var(--sh-muted)" }}>
            {batters.length} {batters.length === 1 ? "batter" : "batters"} ·{" "}
            <span style={{ color: isComplete ? "var(--sh-primary)" : "var(--sh-danger)", fontWeight: 600 }}>
              {isComplete ? `✓ ${ts.lineupComplete}` : `○ ${ts.lineupIncomplete}`}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <button
              onClick={autoNumber}
              className="text-xs px-3 py-1.5 rounded-lg border transition-colors hover:opacity-80"
              style={{ borderColor: "var(--sh-border2)", color: "var(--sh-primary)", background: "transparent" }}
            >
              {ts.autoOrder}
            </button>
          )}
          <button
            onClick={printLineupCard}
            className="text-xs px-3 py-1.5 rounded-lg border transition-colors hover:opacity-80"
            style={{ borderColor: "var(--sh-border2)", color: "var(--sh-secondary)", background: "transparent" }}
          >
            🗺 Field card
          </button>
        </div>
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
                        <p className="font-medium flex items-center gap-1.5" style={{ color: "var(--sh-text)" }}>
                          {player.nationality && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={flagUrl(player.nationality)} alt={player.nationality} className="w-5 shrink-0" style={{ height: "14px", objectFit: "cover", borderRadius: "2px" }} />
                          )}
                          {player.name}
                        </p>
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
