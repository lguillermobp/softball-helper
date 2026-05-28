import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ slug: string; gameId: string }> }

async function getLeagueWithRole(slug: string, userId: string, isMasterAdmin: boolean) {
  const league = await prisma.league.findUnique({
    where: { slug },
    include: { userRoles: { where: { userId } } },
  });
  if (!league) return null;
  return league;
}

// PUT — replace all officials + optionally update fieldId
export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, gameId } = await params;
  const isMasterAdmin = (session.user as any).isMasterAdmin as boolean;
  const userId = session.user.id!;

  const league = await getLeagueWithRole(slug, userId, isMasterAdmin);
  if (!league) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = isMasterAdmin || league.userRoles.some(r => r.role === "LEAGUE_ADMIN");
  const isUmpire = league.userRoles.some(r => r.role === "UMPIRE");
  if (!isAdmin && !isUmpire)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const game = await prisma.game.findFirst({ where: { id: gameId, leagueId: league.id } });
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });
  if (game.status === "COMPLETED" || game.status === "CANCELLED")
    return NextResponse.json({ error: "Cannot edit a completed or cancelled game" }, { status: 409 });

  const { umpireIds, scorekeeperId, fieldId } = await req.json() as {
    umpireIds: string[];
    scorekeeperId: string | null;
    fieldId: string | null;
  };

  if (!Array.isArray(umpireIds) || umpireIds.length === 0 || umpireIds.length > 2)
    return NextResponse.json({ error: "1 to 2 umpires required" }, { status: 400 });

  // Validate all user IDs exist in this league
  const allUserIds = [...new Set([...umpireIds, ...(scorekeeperId ? [scorekeeperId] : [])])];
  const members = await prisma.userLeagueRole.findMany({
    where: { leagueId: league.id, userId: { in: allUserIds } },
    select: { userId: true, role: true },
  });
  const memberUserIds = new Set(members.map(m => m.userId));
  if (!allUserIds.every(id => memberUserIds.has(id)))
    return NextResponse.json({ error: "One or more users are not league members" }, { status: 400 });

  // Replace officials and optionally update field in a transaction
  await prisma.$transaction([
    prisma.gameOfficial.deleteMany({ where: { gameId } }),
    prisma.gameOfficial.createMany({
      data: [
        ...umpireIds.map(uid => ({ gameId, userId: uid, role: "UMPIRE" as const })),
        ...(scorekeeperId ? [{ gameId, userId: scorekeeperId, role: "SCOREKEEPER" as const }] : []),
      ],
    }),
    prisma.game.update({
      where: { id: gameId },
      data: { fieldId: fieldId ?? null },
    }),
  ]);

  const updated = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      field: { select: { id: true, name: true } },
      officials: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
  });

  return NextResponse.json(updated);
}
