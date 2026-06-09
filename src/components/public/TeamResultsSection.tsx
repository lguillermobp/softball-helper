"use client";

export interface TeamPastGame {
  id: string; scheduledAt: string;
  homeTeam: string; awayTeam: string;
  homeTeamId: string; awayTeamId: string;
  homeLogoUrl: string | null; awayLogoUrl: string | null;
  homeScore: number; awayScore: number;
  fieldName: string | null;
}

const SDOW = ["SUN","MON","TUE","WED","THU","FRI","SAT"] as const;
const SMON = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"] as const;

function Logo({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoUrl} alt={name} style={{ width: 28, height: 28, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />;
  }
  return (
    <div style={{ width: 28, height: 28, borderRadius: 6, background: "#14532d", display: "flex", alignItems: "center", justifyContent: "center", color: "#4ade80", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
      {name.charAt(0)}
    </div>
  );
}

export function TeamResultsSection({ games, teamId }: { games: TeamPastGame[]; teamId: string }) {
  if (games.length === 0) return null;

  return (
    <section>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "#4ade80", marginBottom: 12 }}>🏁 Results</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {games.map(g => {
          const d = new Date(g.scheduledAt); // runs in browser → correct local time
          const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          const homeWon  = g.homeScore > g.awayScore;
          const awayWon  = g.awayScore > g.homeScore;
          const weAreHome = g.homeTeamId === teamId;
          const weWon   = (weAreHome && homeWon)  || (!weAreHome && awayWon);
          const weLost  = (weAreHome && awayWon)  || (!weAreHome && homeWon);

          return (
            <div key={g.id} style={{ display: "flex", alignItems: "stretch", borderRadius: 12, border: `1px solid ${weWon ? "rgba(74,222,128,0.35)" : weLost ? "rgba(248,113,113,0.25)" : "#1a3a1a"}`, background: "#0d1a0d", overflow: "hidden" }}>
              {/* Date + time block — rendered client-side for correct timezone */}
              <div style={{ padding: "12px 14px", background: "#111c11", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minWidth: 64, flexShrink: 0, gap: 2 }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#4ade80" }}>{SDOW[d.getDay()]}</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: "#f0fdf4", lineHeight: 1 }}>{d.getDate()}</span>
                <span style={{ fontSize: 10, textTransform: "uppercase", color: "#86efac" }}>{SMON[d.getMonth()]}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#86efac", marginTop: 3 }}>{time}</span>
              </div>

              {/* Matchup + score */}
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "12px 16px", minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, justifyContent: "flex-end", overflow: "hidden" }}>
                  <span style={{ color: homeWon ? "#f0fdf4" : "#9ca3af", fontWeight: homeWon ? 700 : 400, fontSize: 14, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.homeTeam}</span>
                  <Logo name={g.homeTeam} logoUrl={g.homeLogoUrl} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, padding: "5px 14px", borderRadius: 8, background: "#111c11", border: "1px solid #1a3a1a" }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: homeWon ? "#f0fdf4" : "#9ca3af", minWidth: 22, textAlign: "center" }}>{g.homeScore}</span>
                  <span style={{ fontSize: 11, color: "#4ade80", fontWeight: 700 }}>–</span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: awayWon ? "#f0fdf4" : "#9ca3af", minWidth: 22, textAlign: "center" }}>{g.awayScore}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, overflow: "hidden" }}>
                  <Logo name={g.awayTeam} logoUrl={g.awayLogoUrl} />
                  <span style={{ color: awayWon ? "#f0fdf4" : "#9ca3af", fontWeight: awayWon ? 700 : 400, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.awayTeam}</span>
                </div>
              </div>

              {/* WIN/LOSS chip + field */}
              <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "center", gap: 5, flexShrink: 0, minWidth: 60 }}>
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", color: weWon ? "#4ade80" : weLost ? "#f87171" : "#86efac", background: weWon ? "rgba(74,222,128,0.12)" : weLost ? "rgba(248,113,113,0.12)" : "rgba(134,239,172,0.08)", borderRadius: 8, padding: "2px 8px" }}>
                  {weWon ? "WIN" : weLost ? "LOSS" : "TIE"}
                </span>
                {g.fieldName && (
                  <span style={{ fontSize: 11, color: "#4ade80", opacity: 0.55, maxWidth: 90, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    📍 {g.fieldName}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
