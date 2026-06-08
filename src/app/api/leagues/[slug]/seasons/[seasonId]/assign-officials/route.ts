import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ slug: string; seasonId: string }> }

export async function POST(req: NextRequest, { params }: Params) {
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

  const { date, fieldId, umpireUserId, scorekeeperUserId } = await req.json();
  if (!date) return NextResponse.json({ error: "date is required" }, { status: 400 });
  if (!umpireUserId && !scorekeeperUserId)
    return NextResponse.json({ error: "Select at least one official" }, { status: 400 });

  // Build UTC day range from YYYY-MM-DD
  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const dayEnd   = new Date(`${date}T23:59:59.999Z`);

  const games = await prisma.game.findMany({
    where: {
      leagueId: league.id,
      seasonId,
      status: "SCHEDULED",
      isPractice: false,
      scheduledAt: { gte: dayStart, lte: dayEnd },
      ...(fieldId ? { fieldId } : {}),
    },
    select: { id: true },
  });

  if (games.length === 0)
    return NextResponse.json({ updated: 0 });

  await prisma.$transaction(
    games.flatMap(g => {
      const ops = [];
      if (umpireUserId) {
        ops.push(
          prisma.gameOfficial.upsert({
            where: { gameId_userId: { gameId: g.id, userId: umpireUserId } },
            update: { role: "UMPIRE" },
            create: { gameId: g.id, userId: umpireUserId, role: "UMPIRE" },
          })
        );
        // Remove any existing umpire that is a different user
        ops.push(
          prisma.gameOfficial.deleteMany({
            where: { gameId: g.id, role: "UMPIRE", userId: { not: umpireUserId } },
          })
        );
      }
      if (scorekeeperUserId) {
        ops.push(
          prisma.gameOfficial.upsert({
            where: { gameId_userId: { gameId: g.id, userId: scorekeeperUserId } },
            update: { role: "SCOREKEEPER" },
            create: { gameId: g.id, userId: scorekeeperUserId, role: "SCOREKEEPER" },
          })
        );
        ops.push(
          prisma.gameOfficial.deleteMany({
            where: { gameId: g.id, role: "SCOREKEEPER", userId: { not: scorekeeperUserId } },
          })
        );
      }
      return ops;
    })
  );

  return NextResponse.json({ updated: games.length });
}
