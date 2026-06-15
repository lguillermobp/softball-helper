import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const league = searchParams.get("league") ?? "";
  const season = searchParams.get("season") ?? "";
  const rows   = JSON.parse(searchParams.get("rows") ?? "[]") as {
    name: string; gp: number; w: number; l: number; t: number; pts: number; rf: number; ra: number;
  }[];

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
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
          <span style={{ fontSize: "32px" }}>🥎</span>
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "22px", fontWeight: 600, letterSpacing: "2px", textTransform: "uppercase" }}>{league}</span>
        </div>
        <div style={{ color: "#ffffff", fontSize: "42px", fontWeight: 800, marginBottom: "6px" }}>Standings</div>
        <div style={{ color: "#4ade80", fontSize: "20px", fontWeight: 500, marginBottom: "40px" }}>{season}</div>

        <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid rgba(34,197,94,0.3)", paddingBottom: "12px", marginBottom: "4px" }}>
          <div style={{ width: "40px", color: "rgba(255,255,255,0.3)", fontSize: "14px", fontWeight: 600 }}>#</div>
          <div style={{ flex: 1, color: "rgba(255,255,255,0.3)", fontSize: "14px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px" }}>Team</div>
          {["GP", "W", "L", "T", "PTS", "RF", "RA"].map(h => (
            <div key={h} style={{ width: "70px", textAlign: "right", color: "rgba(255,255,255,0.3)", fontSize: "14px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px" }}>{h}</div>
          ))}
        </div>

        {displayRows.map((row, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", padding: "14px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", background: i === 0 ? "rgba(34,197,94,0.06)" : "transparent" }}>
            <div style={{ width: "40px", color: i === 0 ? "#4ade80" : "rgba(255,255,255,0.3)", fontSize: "18px", fontWeight: 700 }}>{i + 1}</div>
            <div style={{ flex: 1, color: i === 0 ? "#ffffff" : "rgba(255,255,255,0.85)", fontSize: i === 0 ? "22px" : "20px", fontWeight: i === 0 ? 700 : 500, overflow: "hidden" }}>{row.name}</div>
            {[row.gp, row.w, row.l, row.t, row.pts, row.rf, row.ra].map((v, j) => (
              <div key={j} style={{ width: "70px", textAlign: "right", color: j === 4 ? "#4ade80" : "rgba(255,255,255,0.7)", fontSize: "20px", fontWeight: j === 4 ? 700 : 400 }}>{v}</div>
            ))}
          </div>
        ))}

        <div style={{ marginTop: "auto", display: "flex", justifyContent: "flex-end", color: "rgba(34,197,94,0.4)", fontSize: "16px", letterSpacing: "1px" }}>
          softballhelper.com
        </div>
      </div>
    ),
    { width: 1080, height: 1080 }
  );
}
