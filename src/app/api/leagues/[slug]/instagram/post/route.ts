import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ slug: string }> }

const IG_USER_ID = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID!;
const IG_TOKEN   = process.env.INSTAGRAM_ACCESS_TOKEN!;
const BASE_URL   = (process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "https://softballhelper.com").replace(/\/$/, "");

function igApi(path: string, body: Record<string, string>) {
  return fetch(`https://graph.facebook.com/v25.0${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, access_token: IG_TOKEN }),
  }).then(r => r.json());
}

function gameCaption(homeTeam: string, awayTeam: string, homeScore: number, awayScore: number, leagueName: string, seasonName: string): string {
  const winner = homeScore > awayScore ? homeTeam : awayScore > homeScore ? awayTeam : null;
  const tie = homeScore === awayScore;

  const es = tie
    ? `⚾ ¡Empate! ${awayTeam} ${awayScore} – ${homeScore} ${homeTeam}`
    : `⚾ ¡${winner} gana! ${awayTeam} ${awayScore} – ${homeScore} ${homeTeam}`;

  const en = tie
    ? `⚾ It's a tie! ${awayTeam} ${awayScore} – ${homeScore} ${homeTeam}`
    : `⚾ ${winner} wins! ${awayTeam} ${awayScore} – ${homeScore} ${homeTeam}`;

  return `${es}\n${en}\n\n📋 ${leagueName} · ${seasonName}\n\n#softball #softballhelper #béisbol`;
}

function standingsCaption(leagueName: string, seasonName: string): string {
  return `📊 Clasificación actualizada / Updated standings\n\n📋 ${leagueName} · ${seasonName}\n\n#softball #softballhelper #standings #clasificación`;
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

  let imageUrl: string;
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
    const params = new URLSearchParams({
      home: game.homeTeam.name,
      away: game.awayTeam.name,
      hs: String(game.homeScore),
      as: String(game.awayScore),
      league: league.name,
      season: game.season.name,
      date,
    });
    imageUrl = `${BASE_URL}/api/og/game-result/${body.gameId}?${params}`;
    caption  = gameCaption(game.homeTeam.name, game.awayTeam.name, game.homeScore, game.awayScore, league.name, game.season.name);
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

    // Compute standings server-side
    type Row = { name: string; gp: number; w: number; l: number; t: number; pts: number; rf: number; ra: number };
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

    const params = new URLSearchParams({ league: league.name, season: season.name, rows: JSON.stringify(rows) });
    imageUrl = `${BASE_URL}/api/og/standings/${body.seasonId}?${params}`;
    caption  = standingsCaption(league.name, season.name);
  } else {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Step 1: Create media container
  const container = await igApi(`/${IG_USER_ID}/media`, {
    image_url: imageUrl,
    caption,
  });

  if (!container.id) {
    console.error("[instagram] container error:", container);
    return NextResponse.json({ error: "Failed to create media container", detail: container }, { status: 502 });
  }

  // Wait for container to be ready (Instagram needs a moment to process the image)
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Step 2: Publish
  const publish = await igApi(`/${IG_USER_ID}/media_publish`, {
    creation_id: container.id,
  });

  if (!publish.id) {
    console.error("[instagram] publish error:", publish);
    return NextResponse.json({ error: "Failed to publish", detail: publish }, { status: 502 });
  }

  return NextResponse.json({ ok: true, postId: publish.id });
}
