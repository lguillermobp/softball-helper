import type { PlayerStat } from "@/lib/stats";

interface Props {
  stats: PlayerStat[];
  teamName: string;
  label?: string;
}

const hdr = { color: "var(--sh-muted)", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.05em" };
const card = { borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" };

export function PlayerStatsTable({ stats, teamName, label }: Props) {
  const hasData = stats.some(s => s.ab > 0);

  return (
    <div className="rounded-2xl border overflow-hidden" style={card}>
      <div className="px-4 py-2.5 border-b flex items-center gap-2" style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card2)" }}>
        <span className="font-bold text-sm" style={{ color: "var(--sh-text)" }}>
          📊 {teamName}{label ? ` — ${label}` : ""}
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
                {["#", "Player", "AB", "H", "1B", "2B", "3B", "HR", "BA"].map(h => (
                  <th key={h} className="px-3 py-2.5 text-center first:text-left" style={hdr}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.map((s, i) => (
                <tr key={s.playerId} style={{ borderBottom: i < stats.length - 1 ? "1px solid var(--sh-border)" : "none" }}>
                  <td className="px-3 py-2.5 font-bold" style={{ color: "var(--sh-primary)" }}>
                    {s.jerseyNumber ? `#${s.jerseyNumber}` : "—"}
                  </td>
                  <td className="px-3 py-2.5 font-medium" style={{ color: "var(--sh-text)" }}>{s.name}</td>
                  <td className="px-3 py-2.5 text-center" style={{ color: "var(--sh-muted)" }}>{s.ab}</td>
                  <td className="px-3 py-2.5 text-center font-semibold" style={{ color: "#4ade80" }}>{s.h}</td>
                  <td className="px-3 py-2.5 text-center" style={{ color: "var(--sh-muted)" }}>{s.singles}</td>
                  <td className="px-3 py-2.5 text-center" style={{ color: "#93c5fd" }}>{s.doubles}</td>
                  <td className="px-3 py-2.5 text-center" style={{ color: "#a78bfa" }}>{s.triples}</td>
                  <td className="px-3 py-2.5 text-center font-semibold" style={{ color: "#fcd34d" }}>{s.hr}</td>
                  <td className="px-3 py-2.5 text-center font-bold" style={{ color: s.ab > 0 ? "var(--sh-text)" : "var(--sh-muted)" }}>{s.ba}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
