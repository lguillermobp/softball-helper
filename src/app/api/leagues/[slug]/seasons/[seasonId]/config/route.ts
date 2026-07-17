import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ slug: string; seasonId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const { slug, seasonId } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId        = session.user.id!;
  const isMasterAdmin = (session.user as any).isMasterAdmin as boolean;

  const league = await prisma.league.findUnique({
    where: { slug },
    include: { userRoles: { where: { userId } } },
  });
  if (!league) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = isMasterAdmin || league.userRoles.some(r => r.role === "LEAGUE_ADMIN");
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (league.status === "SUSPENDED") return NextResponse.json({ error: "This league is currently suspended." }, { status: 423 });

  const body = await req.json();
  const {
    pointsWin, pointsTie, pointsLoss,
    showPct, printDark,
    defaultTwinGames, defaultGameDurationMins,
    tiebreakers, requireDob,
  } = body;

  const VALID_TB = new Set(["RD", "RF", "RA", "W"]);

  const data: Record<string, unknown> = {};
  if (pointsWin               !== undefined) data.pointsWin               = Math.max(0, Number(pointsWin));
  if (pointsTie               !== undefined) data.pointsTie               = Math.max(0, Number(pointsTie));
  if (pointsLoss              !== undefined) data.pointsLoss              = Math.max(0, Number(pointsLoss));
  if (showPct                 !== undefined) data.showPct                 = Boolean(showPct);
  if (printDark               !== undefined) data.printDark               = Boolean(printDark);
  if (defaultTwinGames        !== undefined) data.defaultTwinGames        = Boolean(defaultTwinGames);
  if (defaultGameDurationMins !== undefined) data.defaultGameDurationMins = Math.max(15, Number(defaultGameDurationMins));
  if (Array.isArray(tiebreakers)) {
    const clean = (tiebreakers as string[]).filter(t => VALID_TB.has(t));
    data.tiebreakers = clean.join(",");
  }
  if (requireDob !== undefined) data.requireDob = Boolean(requireDob);

  const season = await prisma.season.update({
    where: { id: seasonId, leagueId: league.id },
    data,
  });

  return NextResponse.json(season);
}
