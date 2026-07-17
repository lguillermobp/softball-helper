import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ProposedGame } from "../generate-schedule/route";

interface Params { params: Promise<{ slug: string; seasonId: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const { slug, seasonId } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id!;
  const isMasterAdmin = (session.user as any).isMasterAdmin as boolean;

  const league = await prisma.league.findUnique({
    where: { slug },
    include: { userRoles: { where: { userId } } },
  });
  if (!league) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = isMasterAdmin || league.userRoles.some(r => r.role === "LEAGUE_ADMIN");
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (league.status === "SUSPENDED") return NextResponse.json({ error: "This league is currently suspended." }, { status: 423 });

  const season = await prisma.season.findFirst({ where: { id: seasonId, leagueId: league.id } });
  if (!season) return NextResponse.json({ error: "Season not found" }, { status: 404 });

  const { games }: { games: ProposedGame[] } = await req.json();
  if (!Array.isArray(games) || games.length === 0)
    return NextResponse.json({ error: "No games to save" }, { status: 400 });

  const created = await prisma.$transaction(
    games.map(g => {
      const [year, month, day] = g.date.split("-").map(Number);
      const [hour, minute] = g.startTime.split(":").map(Number);
      const scheduledAt = new Date(year, month - 1, day, hour, minute, 0);

      return prisma.game.create({
        data: {
          leagueId: league.id,
          seasonId,
          homeTeamId: g.homeTeamId,
          awayTeamId: g.awayTeamId,
          fieldId: g.fieldId,
          scheduledAt,
          status: "SCHEDULED",
          hasStats: true,
        },
      });
    })
  );

  return NextResponse.json({ created: created.length });
}
