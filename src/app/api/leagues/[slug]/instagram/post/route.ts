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
function standingsCaption(leagueName: string, seasonName: string) {
  return `Clasificacion actualizada / Updated standings\n\n${leagueName} - ${seasonName}\n\n#softball #softballhelper #standings #clasificacion`;
}

async function buildGameSvg(
  home: string, away: string, hs: number, as_: number,
  league: string, season: string, date: string,
  homeLogo: string | null, awayLogo: string | null, leagueLogo: string | null,
) {
  const homeWins = hs > as_; const awayWins = as_ > hs;
  const homeFill   = homeWins ? "#ffffff" : awayWins ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.75)";
  const awayFill   = awayWins ? "#ffffff" : homeWins ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.75)";
  const hScoreFill = homeWins ? "#4ade80" : "rgba(255,255,255,0.6)";
  const aScoreFill = awayWins ? "#4ade80" : "rgba(255,255,255,0.6)";
  const footer = [trunc(season, 30), date].filter(Boolean).join(" - ");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080">
  ${getFontStyle()}
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0a1a0a"/><stop offset="50%" stop-color="#0f2a0f"/><stop offset="100%" stop-color="#0a1a0a"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1080" fill="url(#bg)"/>
  <circle cx="980" cy="-100" r="300" fill="rgba(34,197,94,0.04)"/>
  <circle cx="100" cy="1000" r="200" fill="rgba(34,197,94,0.04)"/>
  ${logoCircle(leagueLogo, 540, 82, 48, "lgClip", league[0] ?? "L")}
  <text x="540" y="162" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="26" fill="rgba(255,255,255,0.6)" font-weight="bold">${esc(trunc(league, 36))}</text>
  <rect x="415" y="192" width="250" height="44" rx="22" fill="rgba(34,197,94,0.15)" stroke="rgba(34,197,94,0.4)" stroke-width="1"/>
  <text x="540" y="220" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="18" fill="#4ade80" font-weight="bold" letter-spacing="4">FINAL</text>
  ${logoCircle(awayLogo, 220, 370, 75, "awClip", away[0] ?? "A")}
  <text x="220" y="500" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="${awayWins ? 46 : 38}" fill="${awayFill}" font-weight="bold">${esc(trunc(away, 16))}</text>
  <text x="220" y="532" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="16" fill="rgba(255,255,255,0.3)">AWAY</text>
  <text x="390" y="680" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="${awayWins ? 115 : 90}" fill="${aScoreFill}" font-weight="bold">${as_}</text>
  <text x="540" y="665" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="44" fill="rgba(255,255,255,0.2)">-</text>
  <text x="690" y="680" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="${homeWins ? 115 : 90}" fill="${hScoreFill}" font-weight="bold">${hs}</text>
  ${logoCircle(homeLogo, 860, 370, 75, "hmClip", home[0] ?? "H")}
  <text x="860" y="500" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="${homeWins ? 46 : 38}" fill="${homeFill}" font-weight="bold">${esc(trunc(home, 16))}</text>
  <text x="860" y="532" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="16" fill="rgba(255,255,255,0.3)">HOME</text>
  <line x1="480" y1="870" x2="600" y2="870" stroke="rgba(34,197,94,0.3)" stroke-width="1"/>
  <text x="540" y="905" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="18" fill="rgba(255,255,255,0.35)">${esc(footer)}</text>
  <text x="540" y="945" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="16" fill="rgba(34,197,94,0.5)">softballhelper.com</text>
</svg>`;
}

type Row = { name: string; logoUri?: string | null; gp: number; w: number; l: number; t: number; pts: number; rf: number; ra: number };
async function buildStandingsSvg(league: string, season: string, rows: Row[], leagueLogo: string | null = null) {
  const display = rows.slice(0, 10);
  const ROW_H = 68; const TABLE_TOP = 310;
  const svgH = Math.max(1080, TABLE_TOP + display.length * ROW_H + 80);
  const colW = 72; const nameX = 122; const LOGO_R = 24; const LOGO_CX = 88;
  const headers = ["GP","W","L","T","PTS","RF","RA"];
  const firstColX = 1080 - headers.length * colW - 20;
  const headerCols = headers.map((h, i) =>
    `<text x="${firstColX + i * colW + colW / 2}" y="292" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="15" fill="rgba(255,255,255,0.3)" font-weight="bold">${h}</text>`
  ).join("");
  const dataRows = display.map((row, i) => {
    const y = TABLE_TOP + i * ROW_H;
    const isFirst = i === 0;
    const cy = y + ROW_H / 2;
    const bg = isFirst ? `<rect x="0" y="${y}" width="1080" height="${ROW_H}" fill="rgba(34,197,94,0.06)"/>` : "";
    const cells = [row.gp, row.w, row.l, row.t, row.pts, row.rf, row.ra].map((v, j) =>
      `<text x="${firstColX + j * colW + colW / 2}" y="${cy + 8}" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="20" fill="${j === 4 ? "#4ade80" : "rgba(255,255,255,0.7)"}" font-weight="${j === 4 ? "bold" : "normal"}">${v}</text>`
    ).join("");
    const tLogo = logoCircle(row.logoUri ?? null, LOGO_CX, cy, LOGO_R, `tClip${i}`, row.name[0] ?? "T");
    return `${bg}
      <line x1="0" y1="${y + ROW_H}" x2="1080" y2="${y + ROW_H}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
      <text x="38" y="${cy + 8}" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="18" fill="${isFirst ? "#4ade80" : "rgba(255,255,255,0.3)"}" font-weight="bold">${i + 1}</text>
      ${tLogo}
      <text x="${nameX}" y="${cy + 8}" font-family="DejaVu Sans,sans-serif" font-size="${isFirst ? 22 : 20}" fill="${isFirst ? "#ffffff" : "rgba(255,255,255,0.85)"}" font-weight="${isFirst ? "bold" : "normal"}">${esc(trunc(row.name, 26))}</text>
      ${cells}`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="${svgH}">
  ${getFontStyle()}
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0a1a0a"/><stop offset="50%" stop-color="#0f2a0f"/><stop offset="100%" stop-color="#0a1a0a"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="${svgH}" fill="url(#bg)"/>
  ${logoCircle(leagueLogo, 85, 130, 62, "lgClip", league[0] ?? "L")}
  <text x="168" y="92" font-family="DejaVu Sans,sans-serif" font-size="22" fill="rgba(255,255,255,0.5)" font-weight="bold">${esc(trunc(league, 32))}</text>
  <text x="168" y="157" font-family="DejaVu Sans,sans-serif" font-size="50" fill="#ffffff" font-weight="bold">Standings</text>
  <text x="168" y="202" font-family="DejaVu Sans,sans-serif" font-size="24" fill="#4ade80" font-weight="bold">${esc(trunc(season, 38))}</text>
  <line x1="0" y1="302" x2="1080" y2="302" stroke="rgba(34,197,94,0.3)" stroke-width="1"/>
  <text x="38" y="292" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="15" fill="rgba(255,255,255,0.3)" font-weight="bold">#</text>
  <text x="${nameX}" y="292" font-family="DejaVu Sans,sans-serif" font-size="15" fill="rgba(255,255,255,0.3)" font-weight="bold">TEAM</text>
  ${headerCols}
  ${dataRows}
  <text x="1060" y="${svgH - 20}" text-anchor="end" font-family="DejaVu Sans,sans-serif" font-size="16" fill="rgba(34,197,94,0.4)">softballhelper.com</text>
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
    select: { id: true, name: true, logoUrl: true, userRoles: { where: { userId }, select: { role: true } } },
  });
  if (!league) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = isMasterAdmin || league.userRoles.some(r => r.role === "LEAGUE_ADMIN");
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json() as { type: "game" | "standings"; gameId?: string; seasonId?: string };

  let svg: string;
  let caption: string;

  if (body.type === "game" && body.gameId) {
    const game = await prisma.game.findFirst({
      where: { id: body.gameId, leagueId: league.id, status: "COMPLETED" },
      select: {
        homeScore: true, awayScore: true, scheduledAt: true,
        homeTeam: { select: { name: true, logoUrl: true } },
        awayTeam: { select: { name: true, logoUrl: true } },
        season:   { select: { name: true } },
      },
    });
    if (!game || game.homeScore === null || game.awayScore === null) {
      return NextResponse.json({ error: "Game not found or not completed" }, { status: 404 });
    }
    const [leagueLogo, homeLogo, awayLogo] = await Promise.all([
      fetchLogoAsDataUri(league.logoUrl),
      fetchLogoAsDataUri(game.homeTeam.logoUrl),
      fetchLogoAsDataUri(game.awayTeam.logoUrl),
    ]);
    const date = new Date(game.scheduledAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    svg     = await buildGameSvg(game.homeTeam.name, game.awayTeam.name, game.homeScore, game.awayScore, league.name, game.season.name, date, homeLogo, awayLogo, leagueLogo);
    caption = gameCaption(game.homeTeam.name, game.awayTeam.name, game.homeScore, game.awayScore, league.name, game.season.name);
  } else if (body.type === "standings" && body.seasonId) {
    const season = await prisma.season.findFirst({
      where: { id: body.seasonId, leagueId: league.id },
      select: {
        name: true, pointsWin: true, pointsTie: true, pointsLoss: true, tiebreakers: true,
        teams: { select: { id: true, name: true, logoUrl: true } },
        games: {
          where: { status: "COMPLETED", isPractice: false },
          select: { homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true, homeTeam: { select: { id: true, name: true, logoUrl: true } }, awayTeam: { select: { id: true, name: true, logoUrl: true } } },
        },
      },
    });
    if (!season) return NextResponse.json({ error: "Season not found" }, { status: 404 });

    const logoUrlMap = new Map<string, string | null>();
    for (const t of season.teams) logoUrlMap.set(t.id, t.logoUrl ?? null);
    for (const g of season.games) {
      if (!logoUrlMap.has(g.homeTeamId)) logoUrlMap.set(g.homeTeamId, g.homeTeam.logoUrl ?? null);
      if (!logoUrlMap.has(g.awayTeamId)) logoUrlMap.set(g.awayTeamId, g.awayTeam.logoUrl ?? null);
    }

    const map = new Map<string, Row>();
    for (const t of season.teams) map.set(t.id, { name: t.name, gp: 0, w: 0, l: 0, t: 0, pts: 0, rf: 0, ra: 0 });
    for (const g of season.games) {
      if (g.homeScore === null || g.awayScore === null) continue;
      if (!map.has(g.homeTeamId)) map.set(g.homeTeamId, { name: g.homeTeam.name, gp: 0, w: 0, l: 0, t: 0, pts: 0, rf: 0, ra: 0 });
      if (!map.has(g.awayTeamId)) map.set(g.awayTeamId, { name: g.awayTeam.name, gp: 0, w: 0, l: 0, t: 0, pts: 0, rf: 0, ra: 0 });
      const h = map.get(g.homeTeamId)!; const a = map.get(g.awayTeamId)!;
      h.gp++; a.gp++;
      h.rf += g.homeScore; h.ra += g.awayScore;
      a.rf += g.awayScore; a.ra += g.homeScore;
      if (g.homeScore > g.awayScore) { h.w++; h.pts += season.pointsWin; a.l++; a.pts += season.pointsLoss; }
      else if (g.awayScore > g.homeScore) { a.w++; a.pts += season.pointsWin; h.l++; h.pts += season.pointsLoss; }
      else { h.t++; h.pts += season.pointsTie; a.t++; a.pts += season.pointsTie; }
    }
    const tbs = season.tiebreakers.split(",").map(s => s.trim()).filter(Boolean);
    const sortedEntries = Array.from(map.entries()).sort(([,a], [,b]) => {
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
    const rows = sortedEntries.map(([, row]) => row);

    const [leagueLogo, ...teamLogos] = await Promise.all([
      fetchLogoAsDataUri(league.logoUrl),
      ...sortedEntries.map(([id]) => fetchLogoAsDataUri(logoUrlMap.get(id) ?? null)),
    ]);
    rows.forEach((row, i) => { row.logoUri = teamLogos[i] ?? null; });

    svg     = await buildStandingsSvg(league.name, season.name, rows, leagueLogo);
    caption = standingsCaption(league.name, season.name);
  } else {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Generate JPEG in-process and store in DB — gives Instagram a short, clean URL
  const jpeg = await generateJpeg(svg);
  console.log("[instagram] jpeg size:", jpeg.length, "bytes, magic:", jpeg[0]?.toString(16), jpeg[1]?.toString(16));

  const img  = await prisma.igImage.create({ data: { data: Buffer.from(jpeg) } });
  const imageUrl = `${IMAGE_BASE_URL}/api/ig-img/${img.id}`;
  console.log("[instagram] imageUrl:", imageUrl);

  // Clean up old cached images (keep last 20)
  const old = await prisma.igImage.findMany({ orderBy: { createdAt: "asc" }, skip: 20 });
  if (old.length > 0) await prisma.igImage.deleteMany({ where: { id: { in: old.map(o => o.id) } } });

  // Step 1: Create media container
  const container = await igApi(`/${IG_USER_ID}/media`, { image_url: imageUrl, caption });
  if (!container.id) {
    console.error("[instagram] container error:", container);
    return NextResponse.json({ error: "Failed to create media container", imageUrl, detail: container }, { status: 502 });
  }

  // Wait for Instagram to process the image
  await new Promise(resolve => setTimeout(resolve, 4000));

  // Step 2: Publish
  const publish = await igApi(`/${IG_USER_ID}/media_publish`, { creation_id: container.id });
  if (!publish.id) {
    console.error("[instagram] publish error:", publish);
    return NextResponse.json({ error: "Failed to publish", detail: publish }, { status: 502 });
  }

  return NextResponse.json({ ok: true, postId: publish.id });
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
    select: { id: true, name: true, logoUrl: true, userRoles: { where: { userId }, select: { role: true } } },
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
        homeTeam: { select: { name: true, logoUrl: true } },
        awayTeam: { select: { name: true, logoUrl: true } },
        season:   { select: { name: true } },
      },
    });
    if (!game || game.homeScore === null || game.awayScore === null)
      return NextResponse.json({ error: "Game not found or not completed" }, { status: 404 });
    const [leagueLogo, homeLogo, awayLogo] = await Promise.all([
      fetchLogoAsDataUri(league.logoUrl),
      fetchLogoAsDataUri(game.homeTeam.logoUrl),
      fetchLogoAsDataUri(game.awayTeam.logoUrl),
    ]);
    const date = new Date(game.scheduledAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    svg = await buildGameSvg(game.homeTeam.name, game.awayTeam.name, game.homeScore, game.awayScore, league.name, game.season.name, date, homeLogo, awayLogo, leagueLogo);
  } else if (type === "standings" && seasonId) {
    const season = await prisma.season.findFirst({
      where: { id: seasonId, leagueId: league.id },
      select: {
        name: true, pointsWin: true, pointsTie: true, pointsLoss: true, tiebreakers: true,
        teams: { select: { id: true, name: true, logoUrl: true } },
        games: {
          where: { status: "COMPLETED", isPractice: false },
          select: { homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true, homeTeam: { select: { id: true, name: true, logoUrl: true } }, awayTeam: { select: { id: true, name: true, logoUrl: true } } },
        },
      },
    });
    if (!season) return NextResponse.json({ error: "Season not found" }, { status: 404 });
    const logoUrlMap = new Map<string, string | null>();
    for (const t of season.teams) logoUrlMap.set(t.id, t.logoUrl ?? null);
    for (const g of season.games) {
      if (!logoUrlMap.has(g.homeTeamId)) logoUrlMap.set(g.homeTeamId, g.homeTeam.logoUrl ?? null);
      if (!logoUrlMap.has(g.awayTeamId)) logoUrlMap.set(g.awayTeamId, g.awayTeam.logoUrl ?? null);
    }
    const map = new Map<string, Row>();
    for (const t of season.teams) map.set(t.id, { name: t.name, gp: 0, w: 0, l: 0, t: 0, pts: 0, rf: 0, ra: 0 });
    for (const g of season.games) {
      if (g.homeScore === null || g.awayScore === null) continue;
      if (!map.has(g.homeTeamId)) map.set(g.homeTeamId, { name: g.homeTeam.name, gp: 0, w: 0, l: 0, t: 0, pts: 0, rf: 0, ra: 0 });
      if (!map.has(g.awayTeamId)) map.set(g.awayTeamId, { name: g.awayTeam.name, gp: 0, w: 0, l: 0, t: 0, pts: 0, rf: 0, ra: 0 });
      const h = map.get(g.homeTeamId)!; const a = map.get(g.awayTeamId)!;
      h.gp++; a.gp++;
      h.rf += g.homeScore; h.ra += g.awayScore;
      a.rf += g.awayScore; a.ra += g.homeScore;
      if (g.homeScore > g.awayScore) { h.w++; h.pts += season.pointsWin; a.l++; a.pts += season.pointsLoss; }
      else if (g.awayScore > g.homeScore) { a.w++; a.pts += season.pointsWin; h.l++; h.pts += season.pointsLoss; }
      else { h.t++; h.pts += season.pointsTie; a.t++; a.pts += season.pointsTie; }
    }
    const tbs = season.tiebreakers.split(",").map(s => s.trim()).filter(Boolean);
    const sortedEntries = Array.from(map.entries()).sort(([,a], [,b]) => {
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
    const rows = sortedEntries.map(([, row]) => row);
    const [leagueLogo, ...teamLogos] = await Promise.all([
      fetchLogoAsDataUri(league.logoUrl),
      ...sortedEntries.map(([id]) => fetchLogoAsDataUri(logoUrlMap.get(id) ?? null)),
    ]);
    rows.forEach((row, i) => { row.logoUri = teamLogos[i] ?? null; });
    svg = await buildStandingsSvg(league.name, season.name, rows, leagueLogo);
  } else {
    return NextResponse.json({ error: "type + gameId or seasonId required" }, { status: 400 });
  }

  const jpeg = await generateJpeg(svg);
  return new NextResponse(new Uint8Array(jpeg), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-store" },
  });
}
