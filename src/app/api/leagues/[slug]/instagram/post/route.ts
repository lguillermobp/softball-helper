import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import sharp from "sharp";
import fs from "fs";
import path from "path";

// Point fontconfig at our bundled config so it can find /usr/share/fonts on Railway
// (the container ships without /etc/fonts/fonts.conf)
if (!process.env.FONTCONFIG_FILE) {
  process.env.FONTCONFIG_FILE = path.join(process.cwd(), "fontconfig/fonts.conf");
}

// Embed DejaVu Sans as base64 @font-face, reading from the .fonts dir copied during build.
// This bypasses fontconfig entirely — works even if fc-cache fails.
let _fontStyle: string | undefined;
function getFontStyle(): string {
  if (_fontStyle !== undefined) return _fontStyle;
  const candidates = [
    path.join(process.cwd(), ".fonts/DejaVuSans.ttf"),
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/DejaVuSans.ttf",
  ];
  for (const p of candidates) {
    try {
      const b64 = fs.readFileSync(p).toString("base64");
      console.log("[instagram] loaded font from", p);
      _fontStyle = `<style>@font-face { font-family: 'DejaVu Sans'; src: url('data:font/truetype;base64,${b64}') format('truetype'); }</style>`;
      return _fontStyle;
    } catch {}
  }
  console.warn("[instagram] no font found — text will show as boxes");
  // Log what is actually on disk so we can diagnose
  for (const dir of [path.join(process.cwd(), ".fonts"), "/usr/share/fonts/truetype/dejavu"]) {
    try { console.log("[instagram] dir", dir, ":", fs.readdirSync(dir).join(", ")); } catch {}
  }
  _fontStyle = "";
  return _fontStyle;
}

interface Params { params: Promise<{ slug: string }> }

const IG_USER_ID = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID!;
const IG_TOKEN   = process.env.INSTAGRAM_ACCESS_TOKEN!;
const BASE_URL      = (process.env.SOFTBALL_APP_URL ?? process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "https://softballhelper.com").replace(/\/$/, "");
// Use the custom domain (softballhelper.com) — a Cloudflare WAF rule bypasses
// bot protection for /api/ig-img/* so Instagram's crawler can reach the image.
const IMAGE_BASE_URL = BASE_URL;

function igApi(path: string, body: Record<string, string>) {
  return fetch(`https://graph.facebook.com/v25.0${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, access_token: IG_TOKEN }),
  }).then(r => r.json());
}

function esc(s: string) {
  return String(s)
    .replace(/['']/g, "'").replace(/[""]/g, '"').replace(/[–—]/g, "-")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function trunc(s: string, n: number) { return s.length > n ? s.slice(0, n - 1) + "..." : s; }

async function fetchLogoAsDataUri(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get("content-type") ?? "image/jpeg";
    return `data:${ct};base64,${buf.toString("base64")}`;
  } catch { return null; }
}

function logoCircle(uri: string | null, cx: number, cy: number, r: number, clipId: string, letter: string): string {
  const bg = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>`;
  if (!uri) return `${bg}<text x="${cx}" y="${cy + r * 0.38}" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="${Math.round(r * 0.9)}" fill="rgba(255,255,255,0.45)" font-weight="bold">${esc(letter)}</text>`;
  return `<defs><clipPath id="${clipId}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath></defs>${bg}<image href="${uri}" x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" clip-path="url(#${clipId})" preserveAspectRatio="xMidYMid slice"/>`;
}

function gameCaption(homeTeam: string, awayTeam: string, homeScore: number, awayScore: number, leagueName: string, seasonName: string) {
  const winner = homeScore > awayScore ? homeTeam : awayScore > homeScore ? awayTeam : null;
  const tie = homeScore === awayScore;
  const es = tie ? `Empate! ${awayTeam} ${awayScore} - ${homeScore} ${homeTeam}` : `${winner} gana! ${awayTeam} ${awayScore} - ${homeScore} ${homeTeam}`;
  const en = tie ? `It's a tie! ${awayTeam} ${awayScore} - ${homeScore} ${homeTeam}` : `${winner} wins! ${awayTeam} ${awayScore} - ${homeScore} ${homeTeam}`;
  return `${es}\n${en}\n\n${leagueName} - ${seasonName}\n\n#softball #softballhelper #beisbol`;
}
function standingsCaption(leagueName: string, seasonName: string, group: string | null = null) {
  const g = group ? ` — Group ${group}` : "";
  return `Clasificacion actualizada / Updated standings${g}\n\n${leagueName} - ${seasonName}\n\n#softball #softballhelper #standings #clasificacion`;
}

const C = {
  bg:    "#111827",
  white: "#f8fafc",
  text:  "#e2e8f0",
  muted: "#94a3b8",
  dim:   "#64748b",
  green: "#4ade80",
  red:   "#f87171",
  divider: "rgba(148,163,184,0.15)",
} as const;

type ScheduleGame = {
  time: string; away: string; home: string;
  awayLogo: string | null; homeLogo: string | null;
  homeScore: number | null; awayScore: number | null; status: string;
  protestStatus: string | null; protestTeamName: string | null;
};
type ScheduleGroup = { field: string | null; games: ScheduleGame[] };

function buildScheduleSvg(
  league: string, season: string, dateLabel: string,
  groups: ScheduleGroup[], leagueLogo: string | null = null,
): string {
  const FIELD_H = 40; const GAME_H = 90; const HEADER_H = 210;
  let contentH = 0;
  for (const g of groups) { if (g.field) contentH += FIELD_H; contentH += g.games.length * GAME_H; }
  const svgH = Math.max(1080, HEADER_H + contentH + 52);

  let y = HEADER_H;
  let idx = 0;
  let body = "";

  for (const group of groups) {
    if (group.field) {
      body += `<rect x="0" y="${y}" width="1080" height="${FIELD_H}" fill="rgba(34,197,94,0.06)"/>
        <rect x="0" y="${y}" width="4" height="${FIELD_H}" fill="${C.green}"/>
        <text x="18" y="${y + FIELD_H / 2 + 6}" font-family="DejaVu Sans,sans-serif" font-size="13" fill="${C.green}" font-weight="bold" letter-spacing="1">${esc(group.field.toUpperCase())}</text>
        <line x1="0" y1="${y + FIELD_H}" x2="1080" y2="${y + FIELD_H}" stroke="${C.divider}" stroke-width="1"/>`;
      y += FIELD_H;
    }
    for (const g of group.games) {
      const cy = y + GAME_H / 2;
      const textY = cy + 7;
      const done = g.status === "COMPLETED" && g.homeScore !== null && g.awayScore !== null;
      const awayWins = done && g.awayScore! > g.homeScore!;
      const homeWins = done && g.homeScore! > g.awayScore!;
      const awLogo = logoCircle(g.awayLogo, 168, cy, 24, `awC${idx}`, g.away[0] ?? "A");
      const hmLogo = logoCircle(g.homeLogo, 912, cy, 24, `hmC${idx}`, g.home[0] ?? "H");
      const protestPill = (() => {
        if (!g.protestStatus || g.protestStatus === "DENIED") return "";
        const upheld = g.protestStatus === "UPHELD";
        const label = upheld
          ? (g.protestTeamName ? `UPHELD — ${trunc(g.protestTeamName, 16)}` : "UPHELD")
          : "PROTEST FILED";
        const fill = upheld ? "rgba(249,115,22,0.30)" : "rgba(234,179,8,0.30)";
        const textFill = upheld ? "#fb923c" : "#facc15";
        return `<rect x="390" y="${textY + 6}" width="300" height="17" rx="8" fill="${fill}"/>
           <text x="540" y="${textY + 18}" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="11" fill="${textFill}" font-weight="bold">${esc(label)}</text>`;
      })();
      const middle = done
        ? `<text x="472" y="${textY}" text-anchor="end" font-family="DejaVu Sans,sans-serif" font-size="34" fill="${awayWins ? C.green : C.muted}" font-weight="bold">${g.awayScore}</text>
           <text x="540" y="${textY - 2}" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="18" fill="${C.dim}">—</text>
           <text x="608" y="${textY}" text-anchor="start" font-family="DejaVu Sans,sans-serif" font-size="34" fill="${homeWins ? C.green : C.muted}" font-weight="bold">${g.homeScore}</text>
           ${protestPill}`
        : `<text x="540" y="${textY}" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="15" fill="${C.muted}">vs</text>`;
      const awayFill = done ? (awayWins ? C.white : C.muted) : C.text;
      const homeFill = done ? (homeWins ? C.white : C.muted) : C.text;
      const nameSz   = done ? 19 : 21;
      body += `${idx % 2 === 1 ? `<rect x="0" y="${y}" width="1080" height="${GAME_H}" fill="rgba(255,255,255,0.018)"/>` : ""}
        <line x1="0" y1="${y + GAME_H}" x2="1080" y2="${y + GAME_H}" stroke="${C.divider}" stroke-width="1"/>
        <text x="64" y="${textY - 4}" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="17" fill="${C.green}" font-weight="bold">${esc(g.time)}</text>
        <line x1="120" y1="${y + 12}" x2="120" y2="${y + GAME_H - 12}" stroke="${C.divider}" stroke-width="1"/>
        ${awLogo}
        <text x="200" y="${textY}" font-family="DejaVu Sans,sans-serif" font-size="${nameSz}" fill="${awayFill}" font-weight="${awayWins ? "bold" : "normal"}">${esc(trunc(g.away, 14))}</text>
        ${middle}
        <text x="880" y="${textY}" text-anchor="end" font-family="DejaVu Sans,sans-serif" font-size="${nameSz}" fill="${homeFill}" font-weight="${homeWins ? "bold" : "normal"}">${esc(trunc(g.home, 14))}</text>
        ${hmLogo}`;
      y += GAME_H;
      idx++;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="${svgH}">
  ${getFontStyle()}
  <rect width="1080" height="${svgH}" fill="${C.bg}"/>
  <circle cx="1080" cy="0" r="500" fill="rgba(34,197,94,0.02)"/>
  ${logoCircle(leagueLogo, 76, 100, 52, "lgClip", league[0] ?? "L")}
  <text x="148" y="68" font-family="DejaVu Sans,sans-serif" font-size="19" fill="${C.muted}" font-weight="bold">${esc(trunc(league, 36))}</text>
  <text x="148" y="124" font-family="DejaVu Sans,sans-serif" font-size="42" fill="${C.white}" font-weight="bold">${esc(dateLabel)}</text>
  <text x="148" y="170" font-family="DejaVu Sans,sans-serif" font-size="20" fill="${C.green}" font-weight="bold">${esc(trunc(season, 40))}</text>
  <line x1="0" y1="${HEADER_H}" x2="1080" y2="${HEADER_H}" stroke="${C.divider}" stroke-width="1"/>
  ${body}
  <line x1="24" y1="${svgH - 42}" x2="1056" y2="${svgH - 42}" stroke="${C.divider}" stroke-width="1"/>
  <text x="1056" y="${svgH - 18}" text-anchor="end" font-family="DejaVu Sans,sans-serif" font-size="14" fill="${C.dim}">softballhelper.com</text>
</svg>`;
}

function scheduleCaption(league: string, season: string, date: string, groups: ScheduleGroup[]): string {
  const lines = groups.flatMap(grp => {
    const header = grp.field ? [`${grp.field.toUpperCase()}`] : [];
    const rows = grp.games.map(g => {
      const done = g.status === "COMPLETED" && g.homeScore !== null && g.awayScore !== null;
      return done
        ? `${g.time}  ${g.away} ${g.awayScore} - ${g.homeScore} ${g.home}`
        : `${g.time}  ${g.away} vs ${g.home}`;
    });
    return [...header, ...rows];
  });
  return `📅 ${date}\n\n${lines.join("\n")}\n\n${league} — ${season}\n\n#softball #softballhelper #schedule #calendario`;
}

type RosterPlayer = { name: string; jerseyNumber: string | null };

function teamCaption(teamName: string, leagueName: string, players: RosterPlayer[], managerName: string | null, assistantName: string | null) {
  const staff = [managerName && `MGR: ${managerName}`, assistantName && `ASST: ${assistantName}`].filter(Boolean).join("  |  ");
  const lines = players
    .sort((a, b) => {
      const na = parseInt(a.jerseyNumber ?? "9999"), nb = parseInt(b.jerseyNumber ?? "9999");
      return na !== nb ? na - nb : a.name.localeCompare(b.name);
    })
    .map(p => p.jerseyNumber ? `#${p.jerseyNumber} ${p.name}` : p.name);
  return `${teamName} — ${leagueName}${staff ? `\n${staff}` : ""}\n\nRoster / Plantilla\n\n${lines.join("\n")}\n\n#softball #softballhelper #team #equipo`;
}

async function buildTeamSvg(
  teamName: string, leagueName: string,
  teamLogo: string | null, leagueLogo: string | null,
  players: RosterPlayer[],
  managerName: string | null,
  assistantName: string | null,
): Promise<string> {
  const sorted = [...players].sort((a, b) => {
    const na = parseInt(a.jerseyNumber ?? "9999"), nb = parseInt(b.jerseyNumber ?? "9999");
    return na !== nb ? na - nb : a.name.localeCompare(b.name);
  });

  const hasStaff = !!(managerName || assistantName);
  const STAFF_H   = hasStaff ? 48 : 0;
  const BASE_H    = 310; // league logo + team logo + team name
  const HEADER_H  = BASE_H + STAFF_H;
  const FOOTER_H  = 52;
  const availH    = 1080 - HEADER_H - FOOTER_H;
  const rows      = Math.ceil(sorted.length / 2);
  const ROW_H     = rows > 0 ? Math.max(34, Math.min(58, Math.floor(availH / rows))) : 54;
  const svgH      = Math.max(1080, HEADER_H + rows * ROW_H + FOOTER_H);
  const nameFontSz = Math.round(Math.max(14, Math.min(20, ROW_H * 0.38)));
  const numFontSz  = Math.round(nameFontSz * 0.85);

  // Staff section — manager (green) left, assistant (purple) right
  const staffY = BASE_H + STAFF_H / 2 + 6;
  const staffSection = hasStaff ? `
  <rect x="0" y="${BASE_H}" width="1080" height="${STAFF_H}" fill="rgba(255,255,255,0.025)"/>
  ${managerName ? `
  <text x="40" y="${staffY - 10}" font-family="DejaVu Sans,sans-serif" font-size="11" fill="${C.green}" font-weight="bold" letter-spacing="1">MANAGER</text>
  <text x="40" y="${staffY + 8}" font-family="DejaVu Sans,sans-serif" font-size="17" fill="${C.white}" font-weight="bold">${esc(trunc(managerName, 24))}</text>` : ""}
  ${assistantName ? `
  <text x="560" y="${staffY - 10}" font-family="DejaVu Sans,sans-serif" font-size="11" fill="#c084fc" font-weight="bold" letter-spacing="1">ASSISTANT</text>
  <text x="560" y="${staffY + 8}" font-family="DejaVu Sans,sans-serif" font-size="17" fill="${C.white}" font-weight="bold">${esc(trunc(assistantName, 24))}</text>` : ""}
  <line x1="0" y1="${HEADER_H}" x2="1080" y2="${HEADER_H}" stroke="${C.divider}" stroke-width="1"/>` : "";

  // Build player rows — two columns
  const COL1_NUM = 64; const COL1_NAME = 96;
  const COL2_NUM = 604; const COL2_NAME = 636;
  const playerRows = sorted.map((p, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const y   = HEADER_H + row * ROW_H + ROW_H / 2 + nameFontSz * 0.38;
    const numX  = col === 0 ? COL1_NUM : COL2_NUM;
    const nameX = col === 0 ? COL1_NAME : COL2_NAME;
    const numEl = p.jerseyNumber
      ? `<text x="${numX}" y="${y}" text-anchor="end" font-family="DejaVu Sans,sans-serif" font-size="${numFontSz}" fill="${C.green}" font-weight="bold">#${esc(p.jerseyNumber)}</text>`
      : "";
    return `${numEl}<text x="${nameX}" y="${y}" font-family="DejaVu Sans,sans-serif" font-size="${nameFontSz}" fill="${C.text}">${esc(trunc(p.name, 22))}</text>`;
  }).join("\n");

  // Column divider
  const gridTop = HEADER_H + 8;
  const gridBot = HEADER_H + rows * ROW_H - 8;
  const colDivider = sorted.length > 1
    ? `<line x1="540" y1="${gridTop}" x2="540" y2="${gridBot}" stroke="${C.divider}" stroke-width="1"/>`
    : "";

  // Row dividers
  const rowDividers = Array.from({ length: rows - 1 }, (_, i) =>
    `<line x1="24" y1="${HEADER_H + (i + 1) * ROW_H}" x2="1056" y2="${HEADER_H + (i + 1) * ROW_H}" stroke="${C.divider}" stroke-width="1"/>`
  ).join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="${svgH}">
  ${getFontStyle()}
  <rect width="1080" height="${svgH}" fill="${C.bg}"/>
  <circle cx="1080" cy="0" r="480" fill="rgba(34,197,94,0.025)"/>
  <circle cx="0" cy="${svgH}" r="360" fill="rgba(34,197,94,0.02)"/>
  ${logoCircle(leagueLogo, 80, 68, 40, "lgClip", leagueName[0] ?? "L")}
  <text x="134" y="58" font-family="DejaVu Sans,sans-serif" font-size="18" fill="${C.muted}" font-weight="bold">${esc(trunc(leagueName, 40))}</text>
  <text x="134" y="84" font-family="DejaVu Sans,sans-serif" font-size="13" fill="${C.dim}" letter-spacing="2">ROSTER / PLANTILLA</text>
  ${logoCircle(teamLogo, 540, 178, 72, "tmClip", teamName[0] ?? "T")}
  <text x="540" y="280" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="38" fill="${C.white}" font-weight="bold">${esc(trunc(teamName, 22))}</text>
  <line x1="0" y1="${BASE_H}" x2="1080" y2="${BASE_H}" stroke="${C.divider}" stroke-width="1"/>
  ${staffSection}
  ${rowDividers}
  ${colDivider}
  ${playerRows}
  <line x1="24" y1="${svgH - FOOTER_H + 10}" x2="1056" y2="${svgH - FOOTER_H + 10}" stroke="${C.divider}" stroke-width="1"/>
  <text x="1056" y="${svgH - FOOTER_H + 36}" text-anchor="end" font-family="DejaVu Sans,sans-serif" font-size="14" fill="${C.dim}">softballhelper.com</text>
</svg>`;
}

async function buildGameSvg(
  home: string, away: string, hs: number, as_: number,
  league: string, season: string, date: string,
  homeLogo: string | null, awayLogo: string | null, leagueLogo: string | null,
  protestStatus?: string | null, protestTeamName?: string | null,
) {
  const homeWins = hs > as_; const awayWins = as_ > hs;
  const homeFill   = homeWins ? C.white : awayWins ? C.muted : C.text;
  const awayFill   = awayWins ? C.white : homeWins ? C.muted : C.text;
  const hScoreFill = homeWins ? C.green : C.muted;
  const aScoreFill = awayWins ? C.green : C.muted;
  const footer = [trunc(season, 30), date].filter(Boolean).join(" · ");
  const protestBadge = protestStatus === "FILED"
    ? `<rect x="270" y="236" width="540" height="36" rx="18" fill="rgba(234,179,8,0.30)" stroke="rgba(234,179,8,0.70)" stroke-width="1.5"/>
       <text x="540" y="260" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="14" fill="#facc15" font-weight="bold" letter-spacing="2">BAJO PROTESTA / UNDER PROTEST</text>`
    : protestStatus === "UPHELD"
    ? `<rect x="270" y="236" width="540" height="${protestTeamName ? 52 : 36}" rx="18" fill="rgba(249,115,22,0.30)" stroke="rgba(249,115,22,0.70)" stroke-width="1.5"/>
       <text x="540" y="${protestTeamName ? 254 : 260}" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="12" fill="#fb923c" font-weight="bold" letter-spacing="1">PROTESTA ACEPTADA / PROTEST UPHELD</text>
       ${protestTeamName ? `<text x="540" y="275" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="15" fill="#fb923c" font-weight="bold">${esc(trunc(protestTeamName, 30))}</text>` : ""}`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080">
  ${getFontStyle()}
  <rect width="1080" height="1080" fill="${C.bg}"/>
  <circle cx="1080" cy="0" r="480" fill="rgba(34,197,94,0.025)"/>
  <circle cx="0" cy="1080" r="360" fill="rgba(34,197,94,0.02)"/>
  ${logoCircle(leagueLogo, 540, 82, 48, "lgClip", league[0] ?? "L")}
  <text x="540" y="158" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="22" fill="${C.muted}" font-weight="bold">${esc(trunc(league, 36))}</text>
  <rect x="420" y="184" width="240" height="40" rx="20" fill="rgba(34,197,94,0.15)" stroke="rgba(74,222,128,0.35)" stroke-width="1.5"/>
  <text x="540" y="210" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="16" fill="${C.green}" font-weight="bold" letter-spacing="4">FINAL</text>
  ${protestBadge}
  ${logoCircle(awayLogo, 220, 368, 75, "awClip", away[0] ?? "A")}
  <text x="220" y="496" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="${awayWins ? 44 : 36}" fill="${awayFill}" font-weight="bold">${esc(trunc(away, 16))}</text>
  <text x="220" y="526" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="14" fill="${C.dim}" font-weight="bold" letter-spacing="2">AWAY</text>
  <text x="390" y="678" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="${awayWins ? 114 : 90}" fill="${aScoreFill}" font-weight="bold">${as_}</text>
  <text x="540" y="660" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="40" fill="${C.dim}">—</text>
  <text x="690" y="678" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="${homeWins ? 114 : 90}" fill="${hScoreFill}" font-weight="bold">${hs}</text>
  ${logoCircle(homeLogo, 860, 368, 75, "hmClip", home[0] ?? "H")}
  <text x="860" y="496" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="${homeWins ? 44 : 36}" fill="${homeFill}" font-weight="bold">${esc(trunc(home, 16))}</text>
  <text x="860" y="526" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="14" fill="${C.dim}" font-weight="bold" letter-spacing="2">HOME</text>
  <line x1="40" y1="876" x2="1040" y2="876" stroke="${C.divider}" stroke-width="1"/>
  <text x="540" y="914" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="18" fill="${C.dim}">${esc(footer)}</text>
  <text x="540" y="952" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="16" fill="${C.green}">softballhelper.com</text>
</svg>`;
}

type StandingRow = {
  _id?: string; // internal — team id for logo lookup, not rendered
  name: string; logoUri?: string | null;
  rank: number; gp: number; w: number; l: number; t: number;
  pts: number; rf: number; ra: number; pct: string;
};

type SE = { id: string; name: string; group: string | null; gp: number; w: number; l: number; t: number; pts: number; rf: number; ra: number };

function tbVal(e: SE, key: string): number {
  return key === "RD" ? e.rf - e.ra : key === "RF" ? e.rf : key === "RA" ? -e.ra : key === "W" ? e.w : 0;
}

type SeasonData = {
  name: string; pointsWin: number; pointsTie: number; pointsLoss: number; tiebreakers: string; showPct: boolean;
  teams: Array<{ id: string; name: string; logoUrl: string | null; group: string | null }>;
  games: Array<{
    homeTeamId: string; awayTeamId: string; homeScore: number | null; awayScore: number | null;
    protestStatus: string | null; protestTeamId: string | null;
    homeTeam: { id: string; name: string; logoUrl: string | null };
    awayTeam: { id: string; name: string; logoUrl: string | null };
  }>;
};

function computeSeasonStats(season: SeasonData) {
  const statsMap = new Map<string, SE>();
  const logoUrlMap = new Map<string, string | null>();
  for (const t of season.teams) {
    statsMap.set(t.id, { id: t.id, name: t.name, group: t.group ?? null, gp: 0, w: 0, l: 0, t: 0, pts: 0, rf: 0, ra: 0 });
    logoUrlMap.set(t.id, t.logoUrl ?? null);
  }
  for (const g of season.games) {
    if (g.homeScore === null || g.awayScore === null) continue;
    const hs = g.homeScore, as_ = g.awayScore;
    const home = statsMap.get(g.homeTeamId); const away = statsMap.get(g.awayTeamId);
    if (!home || !away) continue;
    home.gp++; away.gp++; home.rf += hs; home.ra += as_; away.rf += as_; away.ra += hs;
    let homeWins: boolean | null = hs > as_ ? true : as_ > hs ? false : null;
    if (g.protestStatus === "UPHELD" && g.protestTeamId) {
      const pwbs = (g.protestTeamId === g.homeTeamId && hs > as_) || (g.protestTeamId === g.awayTeamId && as_ > hs);
      if (!pwbs) homeWins = g.protestTeamId === g.homeTeamId ? true : false;
    }
    if (homeWins === true)       { home.w++; home.pts += season.pointsWin;  away.l++; away.pts += season.pointsLoss; }
    else if (homeWins === false)  { away.w++; away.pts += season.pointsWin;  home.l++; home.pts += season.pointsLoss; }
    else                          { home.t++; home.pts += season.pointsTie;  away.t++; away.pts += season.pointsTie;  }
    if (!logoUrlMap.has(g.homeTeamId)) logoUrlMap.set(g.homeTeamId, g.homeTeam.logoUrl ?? null);
    if (!logoUrlMap.has(g.awayTeamId)) logoUrlMap.set(g.awayTeamId, g.awayTeam.logoUrl ?? null);
  }

  const groupMap = new Map<string, SE[]>();
  for (const e of statsMap.values()) {
    const key = e.group ?? "";
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(e);
  }
  const sortedGroupKeys = [...groupMap.keys()].sort((a, b) => (!a && b) ? 1 : (a && !b) ? -1 : a.localeCompare(b));
  const tbs = season.tiebreakers.split(",").map(s => s.trim()).filter(Boolean);
  return { statsMap, logoUrlMap, groupMap, sortedGroupKeys, tbs };
}

function toStandingRows(entries: SE[], tbs: string[], _logoUrlMap?: Map<string, string | null>): StandingRow[] {
  const cmp = (a: SE, b: SE) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    for (const tb of tbs) { const d = tbVal(b, tb) - tbVal(a, tb); if (d) return d; }
    return a.name.localeCompare(b.name);
  };
  return [...entries].sort(cmp).map((e, i, arr) => {
    let rank = i + 1;
    for (let j = i - 1; j >= 0; j--) {
      const p = arr[j]; if (p.pts !== e.pts) break;
      if (tbs.every(tb => tbVal(p, tb) === tbVal(e, tb))) rank = j + 1; else break;
    }
    return { _id: e.id, name: e.name, rank, gp: e.gp, w: e.w, l: e.l, t: e.t, pts: e.pts, rf: e.rf, ra: e.ra,
      pct: e.gp > 0 ? (e.w / e.gp).toFixed(3).replace(/^0/, "") : ".000" };
  });
}

async function cleanupOldImages() {
  const old = await prisma.igImage.findMany({ orderBy: { createdAt: "asc" }, skip: 20 });
  if (old.length > 0) await prisma.igImage.deleteMany({ where: { id: { in: old.map(o => o.id) } } });
}

function buildStandingsSvg(
  league: string, season: string, groupName: string | null,
  rows: StandingRow[], showPct: boolean, leagueLogo: string | null = null,
): string {
  const display = rows.slice(0, 12);
  const HEADER_H = 252;
  const COL_HDR_H = 48;
  const TABLE_TOP = HEADER_H + COL_HDR_H;
  // Scale row height to fill the canvas — bigger when few teams, smaller when many
  const availH = 1080 - TABLE_TOP - 52;
  const ROW_H = Math.max(62, Math.min(96, Math.floor(availH / Math.max(display.length, 1))));
  const svgH = Math.max(1080, TABLE_TOP + display.length * ROW_H + 52);

  // Scale logo and font sizes with row height (baseline 62px → reference sizes)
  const scale    = ROW_H / 62;
  const LOGO_R   = Math.round(20 * scale);
  const LOGO_CX  = 70;
  const NAME_X   = LOGO_CX + LOGO_R + 12;
  const nameFontBase = Math.round(19 * scale);
  const cellFont = Math.round(20 * scale);
  const rankFont = Math.round(17 * scale);

  const COL_HDR_Y = HEADER_H + 28;
  const STATS = showPct
    ? ["GP","W","L","T","Pts","RF","RA","RD","PCT"]
    : ["GP","W","L","T","Pts","RF","RA","RD"];
  const TEAM_END = Math.round(NAME_X + 18 * 14); const STAT_RIGHT = 1058;
  const colW = (STAT_RIGHT - TEAM_END) / STATS.length;
  const cx = (i: number) => TEAM_END + (i + 0.5) * colW;

  const RANK_CX = 28;

  const headerCols = STATS.map((h, i) =>
    `<text x="${cx(i)}" y="${COL_HDR_Y}" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="14" fill="${C.muted}" font-weight="bold" letter-spacing="0.5">${h}</text>`
  ).join("");

  const dataRows = display.map((row, i) => {
    const y = TABLE_TOP + i * ROW_H;
    const mid = y + ROW_H / 2;
    const textY = mid + Math.round(rankFont * 0.38);
    const isTop = row.rank === 1;
    const bg = isTop ? `<rect x="0" y="${y}" width="1080" height="${ROW_H}" fill="rgba(34,197,94,0.07)"/>` : "";
    const rd = row.rf - row.ra;
    const rdColor = rd > 0 ? C.green : rd < 0 ? C.red : C.muted;
    const rdText  = rd > 0 ? `+${rd}` : `${rd}`;
    const vals = showPct
      ? [row.gp, row.w, row.l, row.t, row.pts, row.rf, row.ra, rdText, row.pct]
      : [row.gp, row.w, row.l, row.t, row.pts, row.rf, row.ra, rdText];
    const fills = showPct
      ? [C.muted, C.green, C.red, C.muted, C.white, C.muted, C.muted, rdColor, C.muted]
      : [C.muted, C.green, C.red, C.muted, C.white, C.muted, C.muted, rdColor];
    const bolds = [false, true, false, false, true, false, false, true, false];
    const cells = vals.map((v, j) =>
      `<text x="${cx(j)}" y="${textY}" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="${cellFont}" fill="${fills[j]}" font-weight="${bolds[j] ? "bold" : "normal"}">${v}</text>`
    ).join("");
    const tLogo = logoCircle(row.logoUri ?? null, LOGO_CX, mid, LOGO_R, `tClip${i}`, row.name[0] ?? "T");
    const nameFont = isTop ? nameFontBase + 2 : nameFontBase;
    return `${bg}
      <line x1="24" y1="${y + ROW_H}" x2="1056" y2="${y + ROW_H}" stroke="${C.divider}" stroke-width="1"/>
      <text x="${RANK_CX}" y="${textY}" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="${rankFont}" fill="${isTop ? C.green : C.muted}" font-weight="${isTop ? "bold" : "normal"}">${row.rank}</text>
      ${tLogo}
      <text x="${NAME_X}" y="${textY}" font-family="DejaVu Sans,sans-serif" font-size="${nameFont}" fill="${isTop ? C.white : C.text}" font-weight="${isTop ? "bold" : "normal"}">${esc(trunc(row.name, 22))}</text>
      ${cells}`;
  }).join("");

  const groupBadge = groupName
    ? `<rect x="160" y="214" width="${groupName.length * 13 + 88}" height="30" rx="15" fill="rgba(34,197,94,0.15)" stroke="rgba(74,222,128,0.3)" stroke-width="1"/>
       <text x="202" y="234" font-family="DejaVu Sans,sans-serif" font-size="14" fill="${C.green}" font-weight="bold" letter-spacing="1">GROUP ${esc(groupName.toUpperCase())}</text>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="${svgH}">
  ${getFontStyle()}
  <rect width="1080" height="${svgH}" fill="${C.bg}"/>
  <circle cx="1080" cy="0" r="500" fill="rgba(34,197,94,0.02)"/>
  ${logoCircle(leagueLogo, 80, 126, 58, "lgClip", league[0] ?? "L")}
  <text x="158" y="86" font-family="DejaVu Sans,sans-serif" font-size="20" fill="${C.muted}" font-weight="bold">${esc(trunc(league, 36))}</text>
  <text x="158" y="152" font-family="DejaVu Sans,sans-serif" font-size="56" fill="${C.white}" font-weight="bold">Standings</text>
  <text x="158" y="202" font-family="DejaVu Sans,sans-serif" font-size="24" fill="${C.green}" font-weight="bold">${esc(trunc(season, 40))}</text>
  ${groupBadge}
  <line x1="24" y1="${HEADER_H}" x2="1056" y2="${HEADER_H}" stroke="${C.divider}" stroke-width="1"/>
  <text x="${RANK_CX}" y="${COL_HDR_Y}" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="14" fill="${C.muted}" font-weight="bold">#</text>
  <text x="${NAME_X}" y="${COL_HDR_Y}" font-family="DejaVu Sans,sans-serif" font-size="14" fill="${C.muted}" font-weight="bold">TEAM</text>
  ${headerCols}
  ${dataRows}
  <line x1="24" y1="${svgH - 42}" x2="1056" y2="${svgH - 42}" stroke="${C.divider}" stroke-width="1"/>
  <text x="1056" y="${svgH - 18}" text-anchor="end" font-family="DejaVu Sans,sans-serif" font-size="14" fill="${C.dim}">softballhelper.com</text>
</svg>`;
}

async function generateJpeg(svg: string): Promise<Buffer> {
  return sharp(Buffer.from(svg)).jpeg({ quality: 92 }).toBuffer();
}

export async function POST(req: NextRequest, { params }: Params) {
  const { slug } = await params;

  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id!;
  const isMasterAdmin = (session.user as any).isMasterAdmin as boolean;

  if (!IG_USER_ID || !IG_TOKEN) {
    return NextResponse.json({ error: "Instagram not configured" }, { status: 503 });
  }

  const league = await prisma.league.findUnique({
    where: { slug },
    select: { id: true, name: true, logoUrl: true, instagramEnabled: true, timezone: true, userRoles: { where: { userId }, select: { role: true } } },
  });
  if (!league) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = isMasterAdmin || league.userRoles.some(r => r.role === "LEAGUE_ADMIN");
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!league.instagramEnabled) return NextResponse.json({ error: "Instagram publishing is not enabled for this league" }, { status: 403 });

  const body = await req.json() as { type: "game" | "standings" | "schedule" | "team"; gameId?: string; seasonId?: string; group?: string; dayKey?: string; gameIds?: string[]; teamId?: string };

  async function postOneImage(svg: string, caption: string): Promise<{ ok: boolean; postId?: string; error?: string; detail?: unknown }> {
    const jpeg = await generateJpeg(svg);
    console.log("[instagram] jpeg size:", jpeg.length, "bytes");
    const img = await prisma.igImage.create({ data: { data: Buffer.from(jpeg) } });
    const imageUrl = `${IMAGE_BASE_URL}/api/ig-img/${img.id}`;
    console.log("[instagram] imageUrl:", imageUrl);
    const container = await igApi(`/${IG_USER_ID}/media`, { image_url: imageUrl, caption });
    if (!container.id) { console.error("[instagram] container error:", container); return { ok: false, error: "Failed to create media container", detail: container }; }
    await new Promise(resolve => setTimeout(resolve, 4000));
    const publish = await igApi(`/${IG_USER_ID}/media_publish`, { creation_id: container.id });
    if (!publish.id) { console.error("[instagram] publish error:", publish); return { ok: false, error: "Failed to publish", detail: publish }; }
    return { ok: true, postId: publish.id };
  }

  if (body.type === "game" && body.gameId) {
    const game = await prisma.game.findFirst({
      where: { id: body.gameId, leagueId: league.id, status: "COMPLETED" },
      select: {
        homeScore: true, awayScore: true, scheduledAt: true,
        protestStatus: true, protestTeamId: true, homeTeamId: true, awayTeamId: true,
        homeTeam: { select: { name: true, logoUrl: true } },
        awayTeam: { select: { name: true, logoUrl: true } },
        season:   { select: { name: true } },
      },
    });
    if (!game || game.homeScore === null || game.awayScore === null)
      return NextResponse.json({ error: "Game not found or not completed" }, { status: 404 });
    const protestTeamName = game.protestTeamId
      ? (game.protestTeamId === game.homeTeamId ? game.homeTeam.name : game.awayTeam.name)
      : null;
    const [leagueLogo, homeLogo, awayLogo] = await Promise.all([
      fetchLogoAsDataUri(league.logoUrl),
      fetchLogoAsDataUri(game.homeTeam.logoUrl),
      fetchLogoAsDataUri(game.awayTeam.logoUrl),
    ]);
    const tz = league.timezone || "UTC";
    const _d = new Date(game.scheduledAt);
    const date = _d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: tz })
      + " · " + _d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz });
    const svg = await buildGameSvg(game.homeTeam.name, game.awayTeam.name, game.homeScore, game.awayScore, league.name, game.season.name, date, homeLogo, awayLogo, leagueLogo, game.protestStatus, protestTeamName);
    const cap = gameCaption(game.homeTeam.name, game.awayTeam.name, game.homeScore, game.awayScore, league.name, game.season.name);
    const result = await postOneImage(svg, cap);
    if (!result.ok) return NextResponse.json({ error: result.error, detail: result.detail }, { status: 502 });
    await cleanupOldImages();
    return NextResponse.json({ ok: true, postId: result.postId });

  } else if (body.type === "standings" && body.seasonId) {
    const season = await prisma.season.findFirst({
      where: { id: body.seasonId, leagueId: league.id },
      select: {
        name: true, pointsWin: true, pointsTie: true, pointsLoss: true, tiebreakers: true, showPct: true,
        teams: { select: { id: true, name: true, logoUrl: true, group: true } },
        games: {
          where: { status: "COMPLETED", isPractice: false },
          select: {
            homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true,
            protestStatus: true, protestTeamId: true,
            homeTeam: { select: { id: true, name: true, logoUrl: true } },
            awayTeam: { select: { id: true, name: true, logoUrl: true } },
          },
        },
      },
    });
    if (!season) return NextResponse.json({ error: "Season not found" }, { status: 404 });

    const { groupMap, logoUrlMap, tbs, sortedGroupKeys } = computeSeasonStats(season);
    const targetKeys = "group" in body
      ? sortedGroupKeys.filter(k => k === (body.group ?? ""))
      : sortedGroupKeys;
    if (targetKeys.length === 0) return NextResponse.json({ error: "Group not found" }, { status: 404 });

    const leagueLogo = await fetchLogoAsDataUri(league.logoUrl);
    const posts: { group: string | null; postId: string }[] = [];
    for (const groupKey of targetKeys) {
      const rows = toStandingRows(groupMap.get(groupKey)!, tbs, logoUrlMap);
      await Promise.all(rows.map(async (r, i) => { r.logoUri = await fetchLogoAsDataUri(logoUrlMap.get(r._id ?? "") ?? null); }));
      const groupName = groupKey || null;
      const svg = buildStandingsSvg(league.name, season.name, groupName, rows, season.showPct, leagueLogo);
      const cap = standingsCaption(league.name, season.name, groupName);
      const result = await postOneImage(svg, cap);
      if (!result.ok) return NextResponse.json({ error: result.error, detail: result.detail }, { status: 502 });
      posts.push({ group: groupName, postId: result.postId! });
    }
    await cleanupOldImages();
    return NextResponse.json({ ok: true, posts });

  } else if (body.type === "schedule" && body.seasonId && body.gameIds?.length) {
    const dbGames = await prisma.game.findMany({
      where: { id: { in: body.gameIds }, leagueId: league.id },
      select: {
        scheduledAt: true, status: true, homeScore: true, awayScore: true,
        protestStatus: true, protestTeamId: true, homeTeamId: true, awayTeamId: true,
        homeTeam: { select: { name: true, logoUrl: true } },
        awayTeam: { select: { name: true, logoUrl: true } },
        field:    { select: { id: true, name: true } },
      },
      orderBy: { scheduledAt: "asc" },
    });
    if (!dbGames.length) return NextResponse.json({ error: "No games found" }, { status: 404 });

    const season = await prisma.season.findFirst({
      where: { id: body.seasonId, leagueId: league.id },
      select: { name: true },
    });

    const tz = league.timezone || "UTC";
    const d0 = new Date(dbGames[0].scheduledAt);
    const dateLabel = d0.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: tz });

    const leagueLogo = await fetchLogoAsDataUri(league.logoUrl);

    // Group by field (preserving order from catGroups, which is field-sorted)
    const fieldOrder: string[] = [];
    const byField = new Map<string, typeof dbGames>();
    for (const g of dbGames) {
      const fk = g.field?.id ?? "__none__";
      if (!byField.has(fk)) { byField.set(fk, []); fieldOrder.push(fk); }
      byField.get(fk)!.push(g);
    }
    const showFieldHeaders = byField.size > 1 || (byField.size === 1 && !byField.has("__none__"));

    const groups: ScheduleGroup[] = await Promise.all(fieldOrder.map(async fk => {
      const gs = byField.get(fk)!;
      const fieldName = showFieldHeaders ? (gs[0].field?.name ?? null) : null;
      const games: ScheduleGame[] = await Promise.all(gs.map(async g => ({
        time:            new Date(g.scheduledAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz }),
        away:            g.awayTeam.name,
        home:            g.homeTeam.name,
        awayLogo:        await fetchLogoAsDataUri(g.awayTeam.logoUrl),
        homeLogo:        await fetchLogoAsDataUri(g.homeTeam.logoUrl),
        homeScore:       g.homeScore,
        awayScore:       g.awayScore,
        status:          g.status,
        protestStatus:   g.protestStatus,
        protestTeamName: g.protestTeamId
          ? (g.protestTeamId === g.homeTeamId ? g.homeTeam.name : g.awayTeam.name)
          : null,
      })));
      return { field: fieldName, games };
    }));

    const svg = buildScheduleSvg(league.name, season?.name ?? "", dateLabel, groups, leagueLogo);
    const cap = scheduleCaption(league.name, season?.name ?? "", dateLabel, groups);
    const result = await postOneImage(svg, cap);
    if (!result.ok) return NextResponse.json({ error: result.error, detail: result.detail }, { status: 502 });
    await cleanupOldImages();
    return NextResponse.json({ ok: true, postId: result.postId });

  } else if (body.type === "team" && body.teamId) {
    const team = await prisma.team.findFirst({
      where: { id: body.teamId, leagueId: league.id },
      select: {
        name: true, logoUrl: true,
        manager:   { select: { name: true } },
        assistant: { select: { name: true } },
        players: {
          where: { isActive: true },
          select: { name: true, jerseyNumber: true },
          orderBy: [{ jerseyNumber: "asc" }, { name: "asc" }],
        },
      },
    });
    if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

    const [leagueLogo, teamLogo] = await Promise.all([
      fetchLogoAsDataUri(league.logoUrl),
      fetchLogoAsDataUri(team.logoUrl),
    ]);
    const mgrName  = team.manager?.name ?? null;
    const asstName = team.assistant?.name ?? null;
    const svg = await buildTeamSvg(team.name, league.name, teamLogo, leagueLogo, team.players, mgrName, asstName);
    const cap = teamCaption(team.name, league.name, team.players, mgrName, asstName);
    const result = await postOneImage(svg, cap);
    if (!result.ok) return NextResponse.json({ error: result.error, detail: result.detail }, { status: 502 });
    await cleanupOldImages();
    return NextResponse.json({ ok: true, postId: result.postId });

  } else {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

// ── Preview: GET /api/leagues/[slug]/instagram/post?type=game&gameId=X
// Returns the JPEG directly so admins can verify rendering before posting.
export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const userId = session.user.id!;
  const isMasterAdmin = (session.user as any).isMasterAdmin as boolean;

  const league = await prisma.league.findUnique({
    where: { slug },
    select: { id: true, name: true, logoUrl: true, timezone: true, userRoles: { where: { userId }, select: { role: true } } },
  });
  if (!league) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isAdmin = isMasterAdmin || league.userRoles.some(r => r.role === "LEAGUE_ADMIN");
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const type     = searchParams.get("type");
  const gameId   = searchParams.get("gameId");
  const seasonId = searchParams.get("seasonId");

  let svg: string;

  if (type === "game" && gameId) {
    const game = await prisma.game.findFirst({
      where: { id: gameId, leagueId: league.id, status: "COMPLETED" },
      select: {
        homeScore: true, awayScore: true, scheduledAt: true,
        protestStatus: true, protestTeamId: true, homeTeamId: true, awayTeamId: true,
        homeTeam: { select: { name: true, logoUrl: true } },
        awayTeam: { select: { name: true, logoUrl: true } },
        season:   { select: { name: true } },
      },
    });
    if (!game || game.homeScore === null || game.awayScore === null)
      return NextResponse.json({ error: "Game not found or not completed" }, { status: 404 });
    const protestTeamNameGet = game.protestTeamId
      ? (game.protestTeamId === game.homeTeamId ? game.homeTeam.name : game.awayTeam.name)
      : null;
    const [leagueLogo, homeLogo, awayLogo] = await Promise.all([
      fetchLogoAsDataUri(league.logoUrl),
      fetchLogoAsDataUri(game.homeTeam.logoUrl),
      fetchLogoAsDataUri(game.awayTeam.logoUrl),
    ]);
    const tz = league.timezone || "UTC";
    const _d = new Date(game.scheduledAt);
    const date = _d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: tz })
      + " · " + _d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz });
    svg = await buildGameSvg(game.homeTeam.name, game.awayTeam.name, game.homeScore, game.awayScore, league.name, game.season.name, date, homeLogo, awayLogo, leagueLogo, game.protestStatus, protestTeamNameGet);
  } else if (type === "standings" && seasonId) {
    const season = await prisma.season.findFirst({
      where: { id: seasonId, leagueId: league.id },
      select: {
        name: true, pointsWin: true, pointsTie: true, pointsLoss: true, tiebreakers: true, showPct: true,
        teams: { select: { id: true, name: true, logoUrl: true, group: true } },
        games: {
          where: { status: "COMPLETED", isPractice: false },
          select: {
            homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true,
            protestStatus: true, protestTeamId: true,
            homeTeam: { select: { id: true, name: true, logoUrl: true } },
            awayTeam: { select: { id: true, name: true, logoUrl: true } },
          },
        },
      },
    });
    if (!season) return NextResponse.json({ error: "Season not found" }, { status: 404 });
    const { groupMap, logoUrlMap, tbs, sortedGroupKeys } = computeSeasonStats(season);
    const requestedGroup = searchParams.get("group");
    const groupKey = requestedGroup !== null
      ? sortedGroupKeys.find(k => k === requestedGroup) ?? sortedGroupKeys[0]
      : sortedGroupKeys[0];
    if (groupKey === undefined) return NextResponse.json({ error: "No standings data" }, { status: 404 });
    const rows = toStandingRows(groupMap.get(groupKey)!, tbs);
    const [leagueLogo, ...teamLogos] = await Promise.all([
      fetchLogoAsDataUri(league.logoUrl),
      ...rows.map(r => fetchLogoAsDataUri(logoUrlMap.get(r._id ?? "") ?? null)),
    ]);
    rows.forEach((r, i) => { r.logoUri = teamLogos[i] ?? null; });
    svg = buildStandingsSvg(league.name, season.name, groupKey || null, rows, season.showPct, leagueLogo);
  } else if (type === "team") {
    const teamId = searchParams.get("teamId");
    if (!teamId) return NextResponse.json({ error: "teamId required" }, { status: 400 });
    const team = await prisma.team.findFirst({
      where: { id: teamId, leagueId: league.id },
      select: {
        name: true, logoUrl: true,
        manager:   { select: { name: true } },
        assistant: { select: { name: true } },
        players: {
          where: { isActive: true },
          select: { name: true, jerseyNumber: true },
          orderBy: [{ jerseyNumber: "asc" }, { name: "asc" }],
        },
      },
    });
    if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });
    const [leagueLogo, teamLogo] = await Promise.all([
      fetchLogoAsDataUri(league.logoUrl),
      fetchLogoAsDataUri(team.logoUrl),
    ]);
    svg = await buildTeamSvg(team.name, league.name, teamLogo, leagueLogo, team.players, team.manager?.name ?? null, team.assistant?.name ?? null);
  } else {
    return NextResponse.json({ error: "type + gameId or seasonId required" }, { status: 400 });
  }

  const jpeg = await generateJpeg(svg);
  return new NextResponse(new Uint8Array(jpeg), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-store" },
  });
}
