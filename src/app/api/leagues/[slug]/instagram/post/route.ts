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
        homeScore: true, awayScore: true,
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
        season:   { select: { name: true } },
      },
    });
    if (!game || game.homeScore === null || game.awayScore === null) {
      return NextResponse.json({ error: "Game not found or not completed" }, { status: 404 });
    }
    imageUrl = `${BASE_URL}/api/og/game-result/${body.gameId}`;
    caption  = gameCaption(game.homeTeam.name, game.awayTeam.name, game.homeScore, game.awayScore, league.name, game.season.name);
  } else if (body.type === "standings" && body.seasonId) {
    const season = await prisma.season.findFirst({
      where: { id: body.seasonId, leagueId: league.id },
      select: { name: true },
    });
    if (!season) return NextResponse.json({ error: "Season not found" }, { status: 404 });
    imageUrl = `${BASE_URL}/api/og/standings/${body.seasonId}`;
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
