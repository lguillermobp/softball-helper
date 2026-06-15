import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

interface Params { params: Promise<{ seasonId: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { seasonId } = await params;

  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    select: {
      name: true,
      pointsWin: true, pointsTie: true, pointsLoss: true,
      tiebreakers: true,
      league: { select: { name: true } },
      games: {
        where: { status: "COMPLETED", isPractice: false },
        select: {
          homeTeamId: true, awayTeamId: true,
          homeScore: true,  awayScore: true,
          homeTeam: { select: { id: true, name: true } },
          awayTeam: { select: { id: true, name: true } },
        },
      },
      teams: { select: { id: true, name: true } },
    },
  });

  if (!season) return new Response("Not found", { status: 404 });

  // Compute standings
  type Row = { name: string; gp: number; w: number; l: number; t: number; pts: number; rf: number; ra: number };
  const map = new Map<string, Row>();
  for (const t of season.teams) {
    map.set(t.id, { name: t.name, gp: 0, w: 0, l: 0, t: 0, pts: 0, rf: 0, ra: 0 });
  }
  for (const g of season.games) {
    if (g.homeScore === null || g.awayScore === null) continue;
    if (!map.has(g.homeTeamId)) map.set(g.homeTeamId, { name: g.homeTeam.name, gp: 0, w: 0, l: 0, t: 0, pts: 0, rf: 0, ra: 0 });
    if (!map.has(g.awayTeamId)) map.set(g.awayTeamId, { name: g.awayTeam.name, gp: 0, w: 0, l: 0, t: 0, pts: 0, rf: 0, ra: 0 });
    const h = map.get(g.homeTeamId)!;
    const a = map.get(g.awayTeamId)!;
    h.gp++; a.gp++;
    h.rf += g.homeScore; h.ra += g.awayScore;
    a.rf += g.awayScore; a.ra += g.homeScore;
    if (g.homeScore > g.awayScore) {
      h.w++; h.pts += season.pointsWin; a.l++; a.pts += season.pointsLoss;
    } else if (g.awayScore > g.homeScore) {
      a.w++; a.pts += season.pointsWin; h.l++; h.pts += season.pointsLoss;
    } else {
      h.t++; h.pts += season.pointsTie; a.t++; a.pts += season.pointsTie;
    }
  }

  const tbs = season.tiebreakers.split(",").map(s => s.trim()).filter(Boolean);
  const rows = Array.from(map.values()).sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    for (const tb of tbs) {
      let d = 0;
      if (tb === "RD") d = (b.rf - b.ra) - (a.rf - a.ra);
      else if (tb === "RF") d = b.rf - a.rf;
      else if (tb === "RA") d = a.ra - b.ra;
      else if (tb === "W")  d = b.w - a.w;
      if (d !== 0) return d;
    }
    return 0;
  });

  const displayRows = rows.slice(0, 12);

  return new ImageResponse(
    (
      <div
        style={{
          width: "1080px",
          height: "1080px",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #0a1a0a 0%, #0f2a0f 50%, #0a1a0a 100%)",
          fontFamily: "system-ui, sans-serif",
          padding: "60px",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
          <span style={{ fontSize: "32px" }}>🥎</span>
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "22px", fontWeight: 600, letterSpacing: "2px", textTransform: "uppercase" }}>
            {season.league.name}
          </span>
        </div>
        <div style={{ color: "#ffffff", fontSize: "42px", fontWeight: 800, marginBottom: "6px" }}>
          Standings
        </div>
        <div style={{ color: "#4ade80", fontSize: "20px", fontWeight: 500, marginBottom: "40px" }}>
          {season.name}
        </div>

        {/* Table header */}
        <div style={{
          display: "flex", alignItems: "center",
          borderBottom: "1px solid rgba(34,197,94,0.3)",
          paddingBottom: "12px", marginBottom: "4px",
        }}>
          <div style={{ width: "40px", color: "rgba(255,255,255,0.3)", fontSize: "14px", fontWeight: 600 }}>#</div>
          <div style={{ flex: 1, color: "rgba(255,255,255,0.3)", fontSize: "14px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px" }}>Team</div>
          {["GP", "W", "L", "T", "PTS", "RF", "RA"].map(h => (
            <div key={h} style={{ width: "70px", textAlign: "right", color: "rgba(255,255,255,0.3)", fontSize: "14px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px" }}>
              {h}
            </div>
          ))}
        </div>

        {/* Rows */}
        {displayRows.map((row, i) => (
          <div
            key={i}
            style={{
              display: "flex", alignItems: "center",
              padding: "14px 0",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              background: i === 0 ? "rgba(34,197,94,0.06)" : "transparent",
            }}
          >
            <div style={{ width: "40px", color: i === 0 ? "#4ade80" : "rgba(255,255,255,0.3)", fontSize: "18px", fontWeight: 700 }}>
              {i + 1}
            </div>
            <div style={{
              flex: 1,
              color: i === 0 ? "#ffffff" : "rgba(255,255,255,0.85)",
              fontSize: i === 0 ? "22px" : "20px",
              fontWeight: i === 0 ? 700 : 500,
              overflow: "hidden",
            }}>
              {row.name}
            </div>
            {[row.gp, row.w, row.l, row.t, row.pts, row.rf, row.ra].map((v, j) => (
              <div key={j} style={{
                width: "70px", textAlign: "right",
                color: j === 4 ? "#4ade80" : "rgba(255,255,255,0.7)",
                fontSize: "20px",
                fontWeight: j === 4 ? 700 : 400,
              }}>
                {v}
              </div>
            ))}
          </div>
        ))}

        {/* Footer */}
        <div style={{
          marginTop: "auto",
          display: "flex", justifyContent: "flex-end",
          color: "rgba(34,197,94,0.4)", fontSize: "16px", letterSpacing: "1px",
        }}>
          softballhelper.com
        </div>
      </div>
    ),
    { width: 1080, height: 1080 }
  );
}
