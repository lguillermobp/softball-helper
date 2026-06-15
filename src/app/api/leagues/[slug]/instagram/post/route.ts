import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import sharp from "sharp";

interface Params { params: Promise<{ slug: string }> }

const IG_USER_ID = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID!;
const IG_TOKEN   = process.env.INSTAGRAM_ACCESS_TOKEN!;
const BASE_URL   = (process.env.SOFTBALL_APP_URL ?? process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "https://softballhelper.com").replace(/\/$/, "");

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

async function buildGameSvg(home: string, away: string, hs: number, as_: number, league: string, season: string, date: string) {
  const homeWins = hs > as_; const awayWins = as_ > hs;
  const homeFill  = homeWins ? "#ffffff" : awayWins ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.75)";
  const awayFill  = awayWins ? "#ffffff" : homeWins ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.75)";
  const hScoreFill = homeWins ? "#4ade80" : "rgba(255,255,255,0.6)";
  const aScoreFill = awayWins ? "#4ade80" : "rgba(255,255,255,0.6)";
  const footer = [trunc(season, 30), date].filter(Boolean).join(" - ");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0a1a0a"/><stop offset="50%" stop-color="#0f2a0f"/><stop offset="100%" stop-color="#0a1a0a"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1080" fill="url(#bg)"/>
  <circle cx="980" cy="-100" r="300" fill="rgba(34,197,94,0.04)"/>
  <circle cx="100" cy="1000" r="200" fill="rgba(34,197,94,0.04)"/>
  <text x="540" y="110" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="32" fill="rgba(255,255,255,0.6)" font-weight="bold">${esc(trunc(league, 36))}</text>
  <rect x="415" y="140" width="250" height="44" rx="22" fill="rgba(34,197,94,0.15)" stroke="rgba(34,197,94,0.4)" stroke-width="1"/>
  <text x="540" y="168" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="18" fill="#4ade80" font-weight="bold" letter-spacing="4">FINAL</text>
  <text x="270" y="480" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="${awayWins ? 50 : 40}" fill="${awayFill}" font-weight="bold">${esc(trunc(away, 20))}</text>
  <text x="270" y="515" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="16" fill="rgba(255,255,255,0.3)">AWAY</text>
  <text x="420" y="570" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="${awayWins ? 120 : 95}" fill="${aScoreFill}" font-weight="bold">${as_}</text>
  <text x="540" y="555" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="44" fill="rgba(255,255,255,0.2)">-</text>
  <text x="660" y="570" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="${homeWins ? 120 : 95}" fill="${hScoreFill}" font-weight="bold">${hs}</text>
  <text x="810" y="480" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="${homeWins ? 50 : 40}" fill="${homeFill}" font-weight="bold">${esc(trunc(home, 20))}</text>
  <text x="810" y="515" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="16" fill="rgba(255,255,255,0.3)">HOME</text>
  <line x1="480" y1="920" x2="600" y2="920" stroke="rgba(34,197,94,0.3)" stroke-width="1"/>
  <text x="540" y="955" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="18" fill="rgba(255,255,255,0.35)">${esc(footer)}</text>
  <text x="540" y="990" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="16" fill="rgba(34,197,94,0.5)">softballhelper.com</text>
</svg>`;
}

type Row = { name: string; gp: number; w: number; l: number; t: number; pts: number; rf: number; ra: number };
async function buildStandingsSvg(league: string, season: string, rows: Row[]) {
  const display = rows.slice(0, 10);
  const ROW_H = 68; const TABLE_TOP = 290;
  const svgH = Math.max(1080, TABLE_TOP + display.length * ROW_H + 80);
  const colW = 72; const nameX = 100;
  const headers = ["GP","W","L","T","PTS","RF","RA"];
  const firstColX = 1080 - headers.length * colW - 20;
  const headerCols = headers.map((h, i) =>
    `<text x="${firstColX + i * colW + colW / 2}" y="270" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="15" fill="rgba(255,255,255,0.3)" font-weight="bold">${h}</text>`
  ).join("");
  const dataRows = display.map((row, i) => {
    const y = TABLE_TOP + i * ROW_H;
    const isFirst = i === 0;
    const bg = isFirst ? `<rect x="0" y="${y}" width="1080" height="${ROW_H}" fill="rgba(34,197,94,0.06)"/>` : "";
    const cells = [row.gp, row.w, row.l, row.t, row.pts, row.rf, row.ra].map((v, j) =>
      `<text x="${firstColX + j * colW + colW / 2}" y="${y + ROW_H / 2 + 8}" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="20" fill="${j === 4 ? "#4ade80" : "rgba(255,255,255,0.7)"}" font-weight="${j === 4 ? "bold" : "normal"}">${v}</text>`
    ).join("");
    return `${bg}
      <line x1="0" y1="${y + ROW_H}" x2="1080" y2="${y + ROW_H}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
      <text x="50" y="${y + ROW_H / 2 + 8}" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="18" fill="${isFirst ? "#4ade80" : "rgba(255,255,255,0.3)"}" font-weight="bold">${i + 1}</text>
      <text x="${nameX}" y="${y + ROW_H / 2 + 8}" font-family="DejaVu Sans,sans-serif" font-size="${isFirst ? 22 : 20}" fill="${isFirst ? "#ffffff" : "rgba(255,255,255,0.85)"}" font-weight="${isFirst ? "bold" : "normal"}">${esc(trunc(row.name, 28))}</text>
      ${cells}`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="${svgH}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0a1a0a"/><stop offset="50%" stop-color="#0f2a0f"/><stop offset="100%" stop-color="#0a1a0a"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="${svgH}" fill="url(#bg)"/>
  <text x="60" y="90" font-family="DejaVu Sans,sans-serif" font-size="22" fill="rgba(255,255,255,0.5)" font-weight="bold">${esc(trunc(league, 36))}</text>
  <text x="60" y="155" font-family="DejaVu Sans,sans-serif" font-size="50" fill="#ffffff" font-weight="bold">Standings</text>
  <text x="60" y="200" font-family="DejaVu Sans,sans-serif" font-size="24" fill="#4ade80" font-weight="bold">${esc(trunc(season, 40))}</text>
  <line x1="0" y1="280" x2="1080" y2="280" stroke="rgba(34,197,94,0.3)" stroke-width="1"/>
  <text x="50" y="270" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="15" fill="rgba(255,255,255,0.3)" font-weight="bold">#</text>
  <text x="${nameX}" y="270" font-family="DejaVu Sans,sans-serif" font-size="15" fill="rgba(255,255,255,0.3)" font-weight="bold">TEAM</text>
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
    select: { id: true, name: true, userRoles: { where: { userId }, select: { role: true } } },
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
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
        season:   { select: { name: true } },
      },
    });
    if (!game || game.homeScore === null || game.awayScore === null) {
      return NextResponse.json({ error: "Game not found or not completed" }, { status: 404 });
    }
    const date = new Date(game.scheduledAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    svg     = await buildGameSvg(game.homeTeam.name, game.awayTeam.name, game.homeScore, game.awayScore, league.name, game.season.name, date);
    caption = gameCaption(game.homeTeam.name, game.awayTeam.name, game.homeScore, game.awayScore, league.name, game.season.name);
  } else if (body.type === "standings" && body.seasonId) {
    const season = await prisma.season.findFirst({
      where: { id: body.seasonId, leagueId: league.id },
      select: {
        name: true, pointsWin: true, pointsTie: true, pointsLoss: true, tiebreakers: true,
        teams: { select: { id: true, name: true } },
        games: {
          where: { status: "COMPLETED", isPractice: false },
          select: { homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true, homeTeam: { select: { id: true, name: true } }, awayTeam: { select: { id: true, name: true } } },
        },
      },
    });
    if (!season) return NextResponse.json({ error: "Season not found" }, { status: 404 });

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

    svg     = await buildStandingsSvg(league.name, season.name, rows);
    caption = standingsCaption(league.name, season.name);
  } else {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Generate JPEG in-process and store in DB — gives Instagram a short, clean URL
  const jpeg = await generateJpeg(svg);
  const img  = await prisma.igImage.create({ data: { data: Buffer.from(jpeg) } });
  const imageUrl = `${BASE_URL}/api/ig-img/${img.id}`;
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
