import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const home   = searchParams.get("home") ?? "Home";
    const away   = searchParams.get("away") ?? "Away";
    const hs     = Number(searchParams.get("hs") ?? 0);
    const as_    = Number(searchParams.get("as") ?? 0);
    const league = searchParams.get("league") ?? "";
    const season = searchParams.get("season") ?? "";
    const date   = searchParams.get("date") ?? "";

    const tie    = hs === as_;
    const homeWins = hs > as_;
    const awayWins = as_ > hs;

    const winnerColor  = "#4ade80";
    const loserColor   = "rgba(255,255,255,0.55)";
    const winnerScore  = "#4ade80";
    const loserScore   = "rgba(255,255,255,0.55)";

    const homeFill  = tie ? "rgba(255,255,255,0.75)" : homeWins ? "#ffffff"    : loserColor;
    const awayFill  = tie ? "rgba(255,255,255,0.75)" : awayWins ? "#ffffff"    : loserColor;
    const hScoreFill = tie ? "rgba(255,255,255,0.75)" : homeWins ? winnerScore : loserScore;
    const aScoreFill = tie ? "rgba(255,255,255,0.75)" : awayWins ? winnerScore : loserScore;

    function truncate(text: string, max: number) {
      return text.length > max ? text.slice(0, max - 1) + "…" : text;
    }

    const homeLabel = truncate(home, 22);
    const awayLabel = truncate(away, 22);
    const leagueLabel = truncate(league, 36);
    const seasonLabel = truncate(season, 30);
    const footer = [seasonLabel, date].filter(Boolean).join(" · ");

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0a1a0a"/>
      <stop offset="50%" stop-color="#0f2a0f"/>
      <stop offset="100%" stop-color="#0a1a0a"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1080" height="1080" fill="url(#bg)"/>

  <!-- Decorative circles -->
  <circle cx="980" cy="-100" r="300" fill="rgba(34,197,94,0.04)"/>
  <circle cx="100" cy="1000" r="200" fill="rgba(34,197,94,0.04)"/>

  <!-- Header: league name -->
  <text x="540" y="110" text-anchor="middle" font-family="DejaVu Sans,sans-serif"
        font-size="36" fill="rgba(255,255,255,0.6)" font-weight="600"
        letter-spacing="2">${escSvg(leagueLabel)}</text>

  <!-- FINAL badge -->
  <rect x="415" y="140" width="250" height="44" rx="22"
        fill="rgba(34,197,94,0.15)" stroke="rgba(34,197,94,0.4)" stroke-width="1"/>
  <text x="540" y="168" text-anchor="middle" font-family="DejaVu Sans,sans-serif"
        font-size="18" fill="#4ade80" font-weight="700" letter-spacing="4">FINAL</text>

  <!-- Away team name -->
  <text x="270" y="480" text-anchor="middle" font-family="DejaVu Sans,sans-serif"
        font-size="${awayWins ? 50 : 40}" fill="${awayFill}" font-weight="800">${escSvg(awayLabel)}</text>
  <text x="270" y="520" text-anchor="middle" font-family="DejaVu Sans,sans-serif"
        font-size="18" fill="rgba(255,255,255,0.3)" letter-spacing="2">AWAY</text>

  <!-- Scores -->
  <text x="430" y="570" text-anchor="middle" font-family="DejaVu Sans,sans-serif"
        font-size="${awayWins ? 130 : 100}" fill="${aScoreFill}" font-weight="900">${as_}</text>
  <text x="540" y="560" text-anchor="middle" font-family="DejaVu Sans,sans-serif"
        font-size="48" fill="rgba(255,255,255,0.2)" font-weight="300">–</text>
  <text x="650" y="570" text-anchor="middle" font-family="DejaVu Sans,sans-serif"
        font-size="${homeWins ? 130 : 100}" fill="${hScoreFill}" font-weight="900">${hs}</text>

  <!-- Home team name -->
  <text x="810" y="480" text-anchor="middle" font-family="DejaVu Sans,sans-serif"
        font-size="${homeWins ? 50 : 40}" fill="${homeFill}" font-weight="800">${escSvg(homeLabel)}</text>
  <text x="810" y="520" text-anchor="middle" font-family="DejaVu Sans,sans-serif"
        font-size="18" fill="rgba(255,255,255,0.3)" letter-spacing="2">HOME</text>

  <!-- Divider line -->
  <line x1="480" y1="920" x2="600" y2="920" stroke="rgba(34,197,94,0.3)" stroke-width="1"/>

  <!-- Footer -->
  <text x="540" y="955" text-anchor="middle" font-family="DejaVu Sans,sans-serif"
        font-size="20" fill="rgba(255,255,255,0.35)">${escSvg(footer)}</text>
  <text x="540" y="990" text-anchor="middle" font-family="DejaVu Sans,sans-serif"
        font-size="18" fill="rgba(34,197,94,0.5)" letter-spacing="1">softballhelper.com</text>
</svg>`;

    const png = await sharp(Buffer.from(svg)).png().toBuffer();

    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (err) {
    console.error("[og/game-result] error:", err);
    return new NextResponse("Image generation failed", { status: 500 });
  }
}

function escSvg(s: string) {
  return String(s)
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
