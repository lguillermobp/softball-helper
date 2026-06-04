"use client";

import type { OfficialBatterStat, OfficialPitcherStat } from "@/lib/stats";
import { flagUrl } from "@/lib/countries";

const dim: React.CSSProperties = { color: "var(--sh-muted)" };
const head: React.CSSProperties = { color: "var(--sh-text)" };

interface Props {
  batting: OfficialBatterStat[];
  pitching: OfficialPitcherStat[];
  teamName: string;
}

export function OfficialStatsTable({ batting, pitching, teamName }: Props) {
  const card: React.CSSProperties = { borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" };

  if (batting.length === 0 && pitching.length === 0) {
    return (
      <div className="rounded-2xl border py-12 text-center" style={card}>
        <p className="text-2xl mb-2">⚾</p>
        <p className="text-sm font-semibold" style={head}>No official at-bats recorded yet</p>
        <p className="text-xs mt-1" style={dim}>Stats appear here as the scorekeeper records plays</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Batting */}
      {batting.length > 0 && (
        <div className="rounded-2xl border overflow-hidden" style={card}>
          <div className="px-4 py-3 border-b" style={{ borderColor: "var(--sh-border)" }}>
            <span className="text-xs font-bold uppercase tracking-wider" style={dim}>
              🏏 {teamName} — Batting
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--sh-border)" }}>
                  {["Player", "AB", "H", "1B", "2B", "3B", "HR", "BB", "K", "AVG", "OBP"].map(h => (
                    <th key={h} className="px-3 py-2 text-xs font-semibold uppercase tracking-wider"
                      style={{ ...dim, textAlign: h === "Player" ? "left" : "center" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {batting.map(s => (
                  <tr key={s.playerId} style={{ borderBottom: "1px solid var(--sh-border)" }}>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        {s.nationality && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={flagUrl(s.nationality)} alt="" className="w-4 shrink-0" style={{ height: "11px", objectFit: "cover", borderRadius: "1px" }} />
                        )}
                        <span className="font-medium" style={head}>{s.name}</span>
                        {s.jerseyNumber && <span className="text-xs" style={dim}>#{s.jerseyNumber}</span>}
                      </div>
                    </td>
                    {[s.ab, s.h, s.singles, s.doubles, s.triples, s.hr, s.bb, s.k].map((v, i) => (
                      <td key={i} className="px-3 py-2 text-center" style={{ color: "var(--sh-secondary)" }}>{v}</td>
                    ))}
                    <td className="px-3 py-2 text-center font-bold" style={{ color: "var(--sh-primary)" }}>{s.ba}</td>
                    <td className="px-3 py-2 text-center" style={{ color: "var(--sh-secondary)" }}>{s.obp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pitching */}
      {pitching.length > 0 && (
        <div className="rounded-2xl border overflow-hidden" style={card}>
          <div className="px-4 py-3 border-b" style={{ borderColor: "var(--sh-border)" }}>
            <span className="text-xs font-bold uppercase tracking-wider" style={dim}>
              ⚾ {teamName} — Pitching
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--sh-border)" }}>
                  {["Pitcher", "IP", "H", "BB", "K"].map(h => (
                    <th key={h} className="px-3 py-2 text-xs font-semibold uppercase tracking-wider"
                      style={{ ...dim, textAlign: h === "Pitcher" ? "left" : "center" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pitching.map(s => (
                  <tr key={s.playerId} style={{ borderBottom: "1px solid var(--sh-border)" }}>
                    <td className="px-3 py-2">
                      <span className="font-medium" style={head}>{s.name}</span>
                      {s.jerseyNumber && <span className="text-xs ml-1.5" style={dim}>#{s.jerseyNumber}</span>}
                    </td>
                    <td className="px-3 py-2 text-center font-bold" style={{ color: "var(--sh-primary)" }}>{s.ip}</td>
                    <td className="px-3 py-2 text-center" style={{ color: "var(--sh-secondary)" }}>{s.h}</td>
                    <td className="px-3 py-2 text-center" style={{ color: "var(--sh-secondary)" }}>{s.bb}</td>
                    <td className="px-3 py-2 text-center" style={{ color: "var(--sh-secondary)" }}>{s.k}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
