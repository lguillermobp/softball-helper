import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const home   = searchParams.get("home") ?? "Home";
  const away   = searchParams.get("away") ?? "Away";
  const hs     = Number(searchParams.get("hs") ?? 0);
  const as_    = Number(searchParams.get("as") ?? 0);
  const league = searchParams.get("league") ?? "";
  const season = searchParams.get("season") ?? "";
  const date   = searchParams.get("date") ?? "";

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
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background circles */}
        <div style={{ position: "absolute", top: "-200px", right: "-200px", width: "600px", height: "600px", borderRadius: "50%", background: "rgba(34,197,94,0.04)", display: "flex" }} />
        <div style={{ position: "absolute", bottom: "-150px", left: "-150px", width: "400px", height: "400px", borderRadius: "50%", background: "rgba(34,197,94,0.04)", display: "flex" }} />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingTop: "60px", paddingBottom: "20px", gap: "12px" }}>
          <span style={{ fontSize: "36px" }}>🥎</span>
          <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "28px", fontWeight: 600, letterSpacing: "2px", textTransform: "uppercase" }}>
            {league}
          </span>
        </div>

        {/* FINAL badge */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "40px" }}>
          <div style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.4)", color: "#4ade80", fontSize: "18px", fontWeight: 700, letterSpacing: "4px", textTransform: "uppercase", padding: "8px 24px", borderRadius: "20px" }}>
            Final
          </div>
        </div>

        {/* Scoreboard */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
          {/* Away */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "380px" }}>
            <div style={{ fontSize: as_ > hs ? "52px" : "42px", fontWeight: 800, color: as_ > hs ? "#ffffff" : "rgba(255,255,255,0.55)", textAlign: "center", lineHeight: 1.1, maxWidth: "340px", wordBreak: "break-word" }}>
              {away}
            </div>
            <div style={{ fontSize: "18px", color: "rgba(255,255,255,0.35)", fontWeight: 500, marginTop: "8px", textTransform: "uppercase", letterSpacing: "2px" }}>Away</div>
          </div>

          {/* Scores */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px", width: "260px", justifyContent: "center" }}>
            <span style={{ fontSize: as_ > hs ? "110px" : "90px", fontWeight: 900, color: as_ > hs ? "#4ade80" : "rgba(255,255,255,0.6)", lineHeight: 1 }}>{as_}</span>
            <span style={{ fontSize: "48px", color: "rgba(255,255,255,0.2)", fontWeight: 300 }}>—</span>
            <span style={{ fontSize: hs > as_ ? "110px" : "90px", fontWeight: 900, color: hs > as_ ? "#4ade80" : "rgba(255,255,255,0.6)", lineHeight: 1 }}>{hs}</span>
          </div>

          {/* Home */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "380px" }}>
            <div style={{ fontSize: hs > as_ ? "52px" : "42px", fontWeight: 800, color: hs > as_ ? "#ffffff" : "rgba(255,255,255,0.55)", textAlign: "center", lineHeight: 1.1, maxWidth: "340px", wordBreak: "break-word" }}>
              {home}
            </div>
            <div style={{ fontSize: "18px", color: "rgba(255,255,255,0.35)", fontWeight: 500, marginTop: "8px", textTransform: "uppercase", letterSpacing: "2px" }}>Home</div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: "60px", gap: "8px" }}>
          <div style={{ width: "120px", height: "1px", background: "rgba(34,197,94,0.3)" }} />
          <div style={{ color: "rgba(255,255,255,0.35)", fontSize: "20px", marginTop: "12px" }}>{season}{date ? ` · ${date}` : ""}</div>
          <div style={{ color: "rgba(34,197,94,0.5)", fontSize: "18px", letterSpacing: "1px" }}>softballhelper.com</div>
        </div>
      </div>
    ),
    { width: 1080, height: 1080 }
  );
}
