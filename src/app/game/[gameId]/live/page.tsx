import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { flagUrl } from "@/lib/countries";
import Link from "next/link";

interface PageProps { params: Promise<{ gameId: string }> }

export const revalidate = 15; // auto-refresh every 15 seconds via ISR

export default async function GameLivePage({ params }: PageProps) {
  const { gameId } = await params;

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      homeTeam: { select: { id: true, name: true, logoUrl: true } },
      awayTeam: { select: { id: true, name: true, logoUrl: true } },
      field:    { select: { name: true } },
      category: { select: { name: true } },
      season:   { select: { name: true, league: { select: { name: true, slug: true, logoUrl: true } } } },
      officials: { include: { user: { select: { name: true } } } },
      lineups: {
        include: { player: { select: { id: true, name: true, jerseyNumber: true, nationality: true, photoUrl: true } } },
        orderBy: { battingOrder: "asc" },
      },
      innings:  { orderBy: [{ inningNumber: "asc" }, { isTop: "desc" }] },
      atBats:   { orderBy: [{ inningNumber: "asc" }, { isTop: "desc" }, { sequence: "asc" }] },
      pitcherStints: {
        include: { pitcher: { select: { id: true, name: true, jerseyNumber: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!game) notFound();

  const isLive      = game.status === "IN_PROGRESS";
  const isCompleted = game.status === "COMPLETED";
  const isCancelled = game.status === "CANCELLED";

  const homeScore = game.homeScore ?? game.innings.filter(i => !i.isTop).reduce((s, i) => s + i.runsScored, 0);
  const awayScore = game.awayScore ?? game.innings.filter(i => i.isTop).reduce((s, i) => s + i.runsScored, 0);

  // Current half-inning
  const completedHalves = game.innings.filter(i => i.completed);
  const lastHalf = completedHalves[completedHalves.length - 1];
  const currentInning = lastHalf
    ? (lastHalf.isTop ? { number: lastHalf.inningNumber, isTop: false } : { number: lastHalf.inningNumber + 1, isTop: true })
    : { number: 1, isTop: true };

  const currentAtBats = game.atBats.filter(
    ab => ab.inningNumber === currentInning.number && ab.isTop === currentInning.isTop
  );
  const currentOuts = currentAtBats.filter(ab => ab.outcome === "OUT" || ab.outcome === "STRIKEOUT").length;

  // Lineups sorted by batting order
  const homeLineup = game.lineups.filter(l => l.isHome && l.battingOrder != null && l.position !== "B").sort((a, b) => a.battingOrder! - b.battingOrder!);
  const awayLineup = game.lineups.filter(l => !l.isHome && l.battingOrder != null && l.position !== "B").sort((a, b) => a.battingOrder! - b.battingOrder!);

  // Active pitchers
  const activePitcherHome = game.pitcherStints.find(s => s.isHome && s.outsAtEnd == null)?.pitcher;
  const activePitcherAway = game.pitcherStints.find(s => !s.isHome && s.outsAtEnd == null)?.pitcher;

  // Innings scoreboard: unique inning numbers
  const maxInning = Math.max(game.innings.length > 0 ? Math.max(...game.innings.map(i => i.inningNumber)) : 0, isLive ? currentInning.number : 0, 9);
  const inningNumbers = Array.from({ length: maxInning }, (_, i) => i + 1);

  const getInningRuns = (isHome: boolean, inning: number) => {
    const half = game.innings.find(i => i.inningNumber === inning && i.isTop !== isHome);
    return half?.completed ? half.runsScored : isLive && inning === currentInning.number && (currentInning.isTop !== isHome) ? null : "—";
  };

  const date = new Date(game.scheduledAt);
  const league = game.season.league;

  const outcomeLabel: Record<string, string> = {
    SINGLE: "1B", DOUBLE: "2B", TRIPLE: "3B", HOME_RUN: "HR",
    WALK: "BB", OUT: "OUT", STRIKEOUT: "K",
  };

  const outcomeColor: Record<string, string> = {
    SINGLE: "#4ade80", DOUBLE: "#60a5fa", TRIPLE: "#f59e0b", HOME_RUN: "#f87171",
    WALK: "#a78bfa", OUT: "#6b7280", STRIKEOUT: "#6b7280",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f0a", color: "#f0fdf4", fontFamily: "sans-serif" }}>

      {/* Header */}
      <div style={{ borderBottom: "1px solid #1a3a1a", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Link href={`/league/${league.slug}/public`} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          {league.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={league.logoUrl} alt={league.name} style={{ width: 32, height: 32, borderRadius: 8, objectFit: "cover" }} />
          )}
          <span style={{ color: "#4ade80", fontSize: 13, fontWeight: 700 }}>{league.name}</span>
        </Link>
        <span style={{ fontSize: 11, color: "#4ade80", opacity: 0.6 }}>{game.season.name}</span>
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "24px 16px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Status badge */}
        <div style={{ textAlign: "center" }}>
          {isLive && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#14532d", color: "#4ade80", fontSize: 12, fontWeight: 700, padding: "4px 14px", borderRadius: 99, border: "1px solid #16a34a" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#4ade80", display: "inline-block" }} />
              LIVE · Inning {currentInning.number} {currentInning.isTop ? "▲" : "▼"} · {currentOuts} out{currentOuts !== 1 ? "s" : ""}
            </span>
          )}
          {isCompleted && <span style={{ background: "#1e3a5f", color: "#93c5fd", fontSize: 12, fontWeight: 700, padding: "4px 14px", borderRadius: 99 }}>FINAL</span>}
          {isCancelled && <span style={{ background: "#3b1515", color: "#f87171", fontSize: 12, fontWeight: 700, padding: "4px 14px", borderRadius: 99 }}>CANCELLED{game.cancelReason ? ` — ${game.cancelReason}` : ""}</span>}
          {!isLive && !isCompleted && !isCancelled && (
            <span style={{ color: "#4ade80", fontSize: 12, opacity: 0.6 }}>
              {date.toLocaleDateString()} · {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>

        {/* Score card */}
        <div style={{ background: "#0d1a0d", border: "1px solid #1a3a1a", borderRadius: 16, padding: "20px 24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 16 }}>
            {/* Away team */}
            <div style={{ textAlign: "center" }}>
              {game.awayTeam.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={game.awayTeam.logoUrl} alt={game.awayTeam.name} style={{ width: 56, height: 56, borderRadius: 12, objectFit: "cover", margin: "0 auto 8px" }} />
              ) : (
                <div style={{ width: 56, height: 56, borderRadius: 12, background: "#14532d", display: "flex", alignItems: "center", justifyContent: "center", color: "#4ade80", fontWeight: 800, fontSize: 22, margin: "0 auto 8px" }}>{game.awayTeam.name.charAt(0)}</div>
              )}
              <div style={{ fontSize: 13, fontWeight: 700, color: "#f0fdf4", marginBottom: 4 }}>{game.awayTeam.name}</div>
              <div style={{ fontSize: 11, color: "#4ade80", opacity: 0.6 }}>Away</div>
            </div>

            {/* Score */}
            <div style={{ textAlign: "center" }}>
              {(isLive || isCompleted) ? (
                <div style={{ fontSize: 42, fontWeight: 900, letterSpacing: "-2px" }}>
                  <span style={{ color: "#f0fdf4" }}>{awayScore}</span>
                  <span style={{ color: "#1a3a1a", margin: "0 6px" }}>:</span>
                  <span style={{ color: "#f0fdf4" }}>{homeScore}</span>
                </div>
              ) : (
                <div style={{ fontSize: 22, fontWeight: 700, color: "#1a3a1a" }}>vs</div>
              )}
            </div>

            {/* Home team */}
            <div style={{ textAlign: "center" }}>
              {game.homeTeam.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={game.homeTeam.logoUrl} alt={game.homeTeam.name} style={{ width: 56, height: 56, borderRadius: 12, objectFit: "cover", margin: "0 auto 8px" }} />
              ) : (
                <div style={{ width: 56, height: 56, borderRadius: 12, background: "#14532d", display: "flex", alignItems: "center", justifyContent: "center", color: "#4ade80", fontWeight: 800, fontSize: 22, margin: "0 auto 8px" }}>{game.homeTeam.name.charAt(0)}</div>
              )}
              <div style={{ fontSize: 13, fontWeight: 700, color: "#f0fdf4", marginBottom: 4 }}>{game.homeTeam.name}</div>
              <div style={{ fontSize: 11, color: "#4ade80", opacity: 0.6 }}>Home</div>
            </div>
          </div>

          {/* Inning-by-inning scoreboard */}
          {(isLive || isCompleted) && game.innings.length > 0 && (
            <div style={{ marginTop: 20, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #1a3a1a" }}>
                    <th style={{ padding: "6px 8px", textAlign: "left", color: "#4ade80", fontWeight: 700, minWidth: 80 }}>Team</th>
                    {inningNumbers.map(n => (
                      <th key={n} style={{ padding: "6px 6px", textAlign: "center", color: n === currentInning.number && isLive ? "#fbbf24" : "#4ade80", fontWeight: 700, minWidth: 28 }}>{n}</th>
                    ))}
                    <th style={{ padding: "6px 8px", textAlign: "center", color: "#f0fdf4", fontWeight: 700, minWidth: 32 }}>R</th>
                  </tr>
                </thead>
                <tbody>
                  {[false, true].map(isHome => (
                    <tr key={String(isHome)} style={{ borderBottom: "1px solid #0d1a0d" }}>
                      <td style={{ padding: "6px 8px", color: "#f0fdf4", fontWeight: 600 }}>
                        {isHome ? game.homeTeam.name : game.awayTeam.name}
                      </td>
                      {inningNumbers.map(n => {
                        const val = getInningRuns(isHome, n);
                        return (
                          <td key={n} style={{ padding: "6px 6px", textAlign: "center", color: val === null ? "#fbbf24" : "#86efac" }}>
                            {val === null ? "·" : val}
                          </td>
                        );
                      })}
                      <td style={{ padding: "6px 8px", textAlign: "center", fontWeight: 800, color: "#f0fdf4" }}>
                        {isHome ? homeScore : awayScore}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent at-bats */}
        {game.atBats.length > 0 && (
          <section>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: "#4ade80", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
              Recent plays
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {[...game.atBats].reverse().slice(0, 10).map(ab => {
                const batter = [...homeLineup, ...awayLineup].find(l => l.player.id === ab.batterId)?.player;
                const inningLabel = `${ab.inningNumber}${ab.isTop ? "▲" : "▼"}`;
                return (
                  <div key={ab.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, background: "#0d1a0d", border: "1px solid #1a3a1a" }}>
                    <span style={{ fontSize: 10, color: "#4ade80", opacity: 0.6, minWidth: 24 }}>{inningLabel}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: "#1a3a1a", color: outcomeColor[ab.outcome] }}>{outcomeLabel[ab.outcome]}</span>
                    <span style={{ fontSize: 12, color: "#f0fdf4" }}>{batter?.name ?? "—"}</span>
                    {batter?.jerseyNumber && <span style={{ fontSize: 10, color: "#4ade80", opacity: 0.5 }}>#{batter.jerseyNumber}</span>}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Lineups */}
        {(homeLineup.length > 0 || awayLineup.length > 0) && (
          <section>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: "#4ade80", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
              Lineups
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                { lineup: awayLineup, team: game.awayTeam, pitcher: activePitcherAway, label: "Away" },
                { lineup: homeLineup, team: game.homeTeam, pitcher: activePitcherHome, label: "Home" },
              ].map(({ lineup, team, pitcher, label }) => (
                <div key={team.id} style={{ background: "#0d1a0d", border: "1px solid #1a3a1a", borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#f0fdf4", marginBottom: 8 }}>
                    {team.name} <span style={{ color: "#4ade80", fontWeight: 400, fontSize: 10 }}>({label})</span>
                  </div>
                  {pitcher && (
                    <div style={{ fontSize: 11, color: "#a78bfa", marginBottom: 6 }}>
                      ⚾ P: {pitcher.name}{pitcher.jerseyNumber ? ` #${pitcher.jerseyNumber}` : ""}
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {lineup.map(l => (
                      <div key={l.player.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                        <span style={{ color: "#4ade80", opacity: 0.6, minWidth: 14, textAlign: "right" }}>{l.battingOrder}</span>
                        {l.player.nationality && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={flagUrl(l.player.nationality)} alt="" style={{ width: 14, height: 10, objectFit: "cover", borderRadius: 1 }} />
                        )}
                        <span style={{ color: "#f0fdf4" }}>{l.player.name}</span>
                        {l.player.jerseyNumber && <span style={{ color: "#4ade80", opacity: 0.4 }}>#{l.player.jerseyNumber}</span>}
                        <span style={{ color: "#4ade80", opacity: 0.4, marginLeft: "auto" }}>{l.position}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Meta info */}
        <div style={{ fontSize: 11, color: "#4ade80", opacity: 0.4, textAlign: "center", display: "flex", flexDirection: "column", gap: 2 }}>
          {game.field && <span>🏟️ {game.field.name}</span>}
          {game.category && <span>📂 {game.category.name}</span>}
          {isLive && <span>Auto-refreshes every 15 seconds</span>}
        </div>
      </div>
    </div>
  );
}
