import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

export const runtime = "nodejs";

type Row = { name: string; gp: number; w: number; l: number; t: number; pts: number; rf: number; ra: number };

function escSvg(s: string) {
  // Replace curly quotes / fancy chars that librsvg may not have fonts for
  return String(s)
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function truncate(text: string, max: number) {
  return text.length > max ? text.slice(0, max - 1) + "..." : text;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const league = searchParams.get("league") ?? "";
    const season = searchParams.get("season") ?? "";
    const rows: Row[] = JSON.parse(searchParams.get("rows") ?? "[]");
    const displayRows = rows.slice(0, 10);

    const ROW_H = 68;
    const TABLE_TOP = 290;
    const tableHeight = displayRows.length * ROW_H;
    const svgHeight = Math.max(1080, TABLE_TOP + tableHeight + 120);

    const headers = ["GP", "W", "L", "T", "PTS", "RF", "RA"];
    const colW = 72;
    const nameX = 100;
    const firstColX = 1080 - headers.length * colW - 20;

    const headerRow = headers.map((h, i) =>
      `<text x="${firstColX + i * colW + colW / 2}" y="270" text-anchor="middle"
        font-family="system-ui,sans-serif" font-size="16" fill="rgba(255,255,255,0.3)"
        font-weight="600" letter-spacing="1">${h}</text>`
    ).join("\n");

    const dataRows = displayRows.map((row, i) => {
      const y = TABLE_TOP + i * ROW_H;
      const isFirst = i === 0;
      const bg = isFirst ? `<rect x="0" y="${y}" width="1080" height="${ROW_H}" fill="rgba(34,197,94,0.06)"/>` : "";
      const rankColor = isFirst ? "#4ade80" : "rgba(255,255,255,0.3)";
      const nameColor = isFirst ? "#ffffff" : "rgba(255,255,255,0.85)";
      const nameFontSize = isFirst ? 22 : 20;
      const cells = [row.gp, row.w, row.l, row.t, row.pts, row.rf, row.ra].map((v, j) => {
        const fill = j === 4 ? "#4ade80" : "rgba(255,255,255,0.7)";
        const fw = j === 4 ? "700" : "400";
        return `<text x="${firstColX + j * colW + colW / 2}" y="${y + ROW_H / 2 + 8}"
          text-anchor="middle" font-family="system-ui,sans-serif" font-size="20"
          fill="${fill}" font-weight="${fw}">${v}</text>`;
      }).join("\n");
      return `${bg}
        <line x1="0" y1="${y + ROW_H}" x2="1080" y2="${y + ROW_H}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
        <text x="50" y="${y + ROW_H / 2 + 8}" text-anchor="middle"
          font-family="system-ui,sans-serif" font-size="18" fill="${rankColor}" font-weight="700">${i + 1}</text>
        <text x="${nameX}" y="${y + ROW_H / 2 + 8}"
          font-family="system-ui,sans-serif" font-size="${nameFontSize}" fill="${nameColor}" font-weight="${isFirst ? 700 : 500}">${escSvg(truncate(row.name, 28))}</text>
        ${cells}`;
    }).join("\n");

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="${svgHeight}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0a1a0a"/>
      <stop offset="50%" stop-color="#0f2a0f"/>
      <stop offset="100%" stop-color="#0a1a0a"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="${svgHeight}" fill="url(#bg)"/>

  <!-- Header -->
  <text x="60" y="90" font-family="system-ui,sans-serif" font-size="22"
        fill="rgba(255,255,255,0.5)" font-weight="600" letter-spacing="2">${escSvg(truncate(league, 36))}</text>
  <text x="60" y="155" font-family="system-ui,sans-serif" font-size="52"
        fill="#ffffff" font-weight="800">Standings</text>
  <text x="60" y="200" font-family="system-ui,sans-serif" font-size="24"
        fill="#4ade80" font-weight="500">${escSvg(truncate(season, 40))}</text>

  <!-- Table header line -->
  <line x1="0" y1="280" x2="1080" y2="280" stroke="rgba(34,197,94,0.3)" stroke-width="1"/>
  <text x="50" y="270" text-anchor="middle" font-family="system-ui,sans-serif"
        font-size="16" fill="rgba(255,255,255,0.3)" font-weight="600">#</text>
  <text x="${nameX}" y="270" font-family="system-ui,sans-serif"
        font-size="16" fill="rgba(255,255,255,0.3)" font-weight="600" letter-spacing="1">TEAM</text>
  ${headerRow}

  <!-- Data rows -->
  ${dataRows}

  <!-- Footer -->
  <text x="1060" y="${svgHeight - 20}" text-anchor="end" font-family="system-ui,sans-serif"
        font-size="18" fill="rgba(34,197,94,0.4)" letter-spacing="1">softballhelper.com</text>
</svg>`;

    const png = await sharp(Buffer.from(svg)).png().toBuffer();

    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (err) {
    console.error("[og/standings] error:", err);
    return new NextResponse("Image generation failed", { status: 500 });
  }
}
