import sharp from "sharp";
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";

const IG_USER_ID = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID!;
const IG_TOKEN   = process.env.INSTAGRAM_ACCESS_TOKEN!;
const BASE_URL   = (process.env.SOFTBALL_APP_URL ?? process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "https://softballhelper.com").replace(/\/$/, "");

// ── Helpers (self-contained copy for non-blocking auto-post) ─────────────────

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
      _fontStyle = `<style>@font-face { font-family: 'DejaVu Sans'; src: url('data:font/truetype;base64,${b64}') format('truetype'); }</style>`;
      return _fontStyle;
    } catch {}
  }
  _fontStyle = "";
  return _fontStyle;
}

const C = {
  bg: "#111827", white: "#f8fafc", text: "#e2e8f0",
  muted: "#94a3b8", dim: "#64748b", green: "#4ade80",
  red: "#f87171", divider: "rgba(148,163,184,0.15)",
} as const;

function esc(s: string) {
  return String(s)
    .replace(/['']/g, "'").replace(/[""]/g, '"').replace(/[–—]/g, "-")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function trunc(s: string, n: number) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }

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

function buildGameSvg(
  home: string, away: string, hs: number, as_: number,
  league: string, season: string, date: string,
  homeLogo: string | null, awayLogo: string | null, leagueLogo: string | null,
  protestStatus?: string | null, protestTeamName?: string | null,
): string {
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

function gameCaption(homeTeam: string, awayTeam: string, homeScore: number, awayScore: number, leagueName: string, seasonName: string) {
  const winner = homeScore > awayScore ? homeTeam : awayScore > homeScore ? awayTeam : null;
  const tie = homeScore === awayScore;
  const es = tie ? `Empate! ${awayTeam} ${awayScore} - ${homeScore} ${homeTeam}` : `${winner} gana! ${awayTeam} ${awayScore} - ${homeScore} ${homeTeam}`;
  const en = tie ? `It's a tie! ${awayTeam} ${awayScore} - ${homeScore} ${homeTeam}` : `${winner} wins! ${awayTeam} ${awayScore} - ${homeScore} ${homeTeam}`;
  return `${es}\n${en}\n\n${leagueName} - ${seasonName}\n\n#softball #softballhelper #beisbol`;
}

function igApi(igPath: string, body: Record<string, string>) {
  return fetch(`https://graph.facebook.com/v25.0${igPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, access_token: IG_TOKEN }),
  }).then(r => r.json());
}

// ── Main export ──────────────────────────────────────────────────────────────

export async function autoPostGameScoreCard(params: {
  leagueName: string;
  leagueLogoUrl: string | null;
  timezone: string;
  seasonName: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  homeLogoUrl: string | null;
  awayLogoUrl: string | null;
  scheduledAt: Date;
  protestStatus?: string | null;
  protestTeamName?: string | null;
}): Promise<void> {
  if (!IG_USER_ID || !IG_TOKEN) return;

  const { leagueName, leagueLogoUrl, timezone, seasonName, homeTeam, awayTeam, homeScore, awayScore, homeLogoUrl, awayLogoUrl, scheduledAt, protestStatus, protestTeamName } = params;

  const tz = timezone || "UTC";
  const _d = new Date(scheduledAt);
  const date = _d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: tz })
    + " · " + _d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz });

  const [leagueLogo, homeLogo, awayLogo] = await Promise.all([
    fetchLogoAsDataUri(leagueLogoUrl),
    fetchLogoAsDataUri(homeLogoUrl),
    fetchLogoAsDataUri(awayLogoUrl),
  ]);

  const svg = buildGameSvg(homeTeam, awayTeam, homeScore, awayScore, leagueName, seasonName, date, homeLogo, awayLogo, leagueLogo, protestStatus, protestTeamName);
  const jpeg = await sharp(Buffer.from(svg)).jpeg({ quality: 92 }).toBuffer();

  const img = await prisma.igImage.create({ data: { data: Buffer.from(jpeg) } });
  const imageUrl = `${BASE_URL}/api/ig-img/${img.id}`;

  const container = await igApi(`/${IG_USER_ID}/media`, { image_url: imageUrl, caption: gameCaption(homeTeam, awayTeam, homeScore, awayScore, leagueName, seasonName) });
  if (!container.id) { console.error("[ig-auto-post] container error:", container); return; }
  await new Promise(resolve => setTimeout(resolve, 4000));
  const publish = await igApi(`/${IG_USER_ID}/media_publish`, { creation_id: container.id });
  if (!publish.id) console.error("[ig-auto-post] publish error:", publish);
  else console.log("[ig-auto-post] posted game score card:", publish.id);

  // Keep ig_images table tidy
  const old = await prisma.igImage.findMany({ orderBy: { createdAt: "asc" }, skip: 20 });
  if (old.length > 0) await prisma.igImage.deleteMany({ where: { id: { in: old.map(o => o.id) } } });
}
