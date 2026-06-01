"use client";

import { useState } from "react";
import { flagUrl } from "@/lib/countries";
import type { PlayerStat } from "@/lib/stats";

interface Props {
  stats: PlayerStat[];
  teamName: string;
  label?: string;
}

type SortCol = "jersey" | "name" | "ab" | "h" | "singles" | "doubles" | "triples" | "hr" | "ba";

const COLUMNS: { key: SortCol; label: string }[] = [
  { key: "jersey",  label: "#"  },
  { key: "name",    label: "Player" },
  { key: "ab",      label: "AB" },
  { key: "h",       label: "H"  },
  { key: "singles", label: "1B" },
  { key: "doubles", label: "2B" },
  { key: "triples", label: "3B" },
  { key: "hr",      label: "HR" },
  { key: "ba",      label: "BA" },
];

function sortStats(stats: PlayerStat[], col: SortCol, dir: "asc" | "desc"): PlayerStat[] {
  return [...stats].sort((a, b) => {
    let diff = 0;
    switch (col) {
      case "jersey":  diff = (parseInt(a.jerseyNumber ?? "9999") - parseInt(b.jerseyNumber ?? "9999")); break;
      case "name":    diff = a.name.localeCompare(b.name); break;
      case "ab":      diff = a.ab - b.ab; break;
      case "h":       diff = a.h - b.h; break;
      case "singles": diff = a.singles - b.singles; break;
      case "doubles": diff = a.doubles - b.doubles; break;
      case "triples": diff = a.triples - b.triples; break;
      case "hr":      diff = a.hr - b.hr; break;
      case "ba":      diff = (a.ab > 0 ? a.h / a.ab : -1) - (b.ab > 0 ? b.h / b.ab : -1); break;
    }
    return dir === "asc" ? diff : -diff;
  });
}

const hdr = { color: "var(--sh-muted)", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.05em" };
const card = { borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" };

export function PlayerStatsTable({ stats, teamName, label }: Props) {
  const [sortCol, setSortCol] = useState<SortCol>("ab");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const hasData = stats.some(s => s.ab > 0);

  function handleSort(col: SortCol) {
    if (col === sortCol) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortDir(col === "name" || col === "jersey" ? "asc" : "desc");
    }
  }

  const sorted = sortStats(stats, sortCol, sortDir);

  return (
    <div className="rounded-2xl border overflow-hidden" style={card}>
      <div className="px-4 py-2.5 border-b flex items-center gap-2 flex-wrap" style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card2)" }}>
        <span className="font-bold text-sm" style={{ color: "var(--sh-text)" }}>
          📊 {teamName}{label ? ` — ${label}` : ""}
        </span>
        <span className="text-xs font-semibold rounded-full px-2 py-0.5" style={{ background: "var(--sh-bg-card2)", color: "var(--sh-warn)", border: "1px solid var(--sh-border2)" }}>
          Unofficial
        </span>
        {!hasData && (
          <span className="text-xs" style={{ color: "var(--sh-muted)" }}>No at-bats recorded yet</span>
        )}
      </div>

      {stats.length === 0 ? (
        <div className="py-10 text-center text-sm" style={{ color: "var(--sh-muted)" }}>
          No lineup data found.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--sh-border)" }}>
                {COLUMNS.map(col => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className="px-3 py-2.5 text-center select-none"
                    style={{
                      ...hdr,
                      cursor: "pointer",
                      textAlign: col.key === "name" ? "left" : "center",
                      color: sortCol === col.key ? "var(--sh-primary)" : "var(--sh-muted)",
                    }}
                  >
                    {col.label}{sortCol === col.key ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((s, i) => (
                <tr key={s.playerId} style={{ borderBottom: i < sorted.length - 1 ? "1px solid var(--sh-border)" : "none" }}>
                  <td className="px-3 py-2 font-bold" style={{ color: "var(--sh-primary)" }}>
                    {s.jerseyNumber ? `#${s.jerseyNumber}` : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      {s.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.photoUrl} alt={s.name} className="w-7 h-7 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                          style={{ background: "var(--sh-bg-card2)", color: "var(--sh-primary)" }}>
                          {s.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      {s.nationality && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={flagUrl(s.nationality)} alt={s.nationality} className="w-5 shrink-0" style={{ height: "14px", objectFit: "cover", borderRadius: "2px" }} />
                      )}
                      <span className="font-medium" style={{ color: "var(--sh-text)" }}>{s.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center" style={{ color: "var(--sh-muted)" }}>{s.ab}</td>
                  <td className="px-3 py-2 text-center font-semibold" style={{ color: "#4ade80" }}>{s.h}</td>
                  <td className="px-3 py-2 text-center" style={{ color: "var(--sh-muted)" }}>{s.singles}</td>
                  <td className="px-3 py-2 text-center" style={{ color: "#93c5fd" }}>{s.doubles}</td>
                  <td className="px-3 py-2 text-center" style={{ color: "#a78bfa" }}>{s.triples}</td>
                  <td className="px-3 py-2 text-center font-semibold" style={{ color: "#fcd34d" }}>{s.hr}</td>
                  <td className="px-3 py-2 text-center font-bold" style={{ color: s.ab > 0 ? "var(--sh-text)" : "var(--sh-muted)" }}>{s.ba}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
