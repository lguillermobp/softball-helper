import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPlayerInviteEmail } from "@/lib/email";

interface Params { params: Promise<{ slug: string; playerId: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, playerId } = await params;
  const userId = session.user.id!;
  const isMasterAdmin = (session.user as any).isMasterAdmin;

  const league = await prisma.league.findUnique({
    where: { slug },
    include: { userRoles: { where: { userId } } },
  });
  if (!league) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = isMasterAdmin || league.userRoles.some(
    (r) => r.role === "LEAGUE_ADMIN" || r.role === "TEAM_MANAGER"
  );
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const player = await prisma.player.findFirst({
    where: { id: playerId, leagueId: league.id },
    include: {
      team: { select: { name: true } },
      user: { select: { id: true, password: true, emailVerified: true } },
    },
  });
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });
  if (!player.email) return NextResponse.json({ error: "Player has no email address" }, { status: 400 });

  // If user already has a password and verified email, no need to resend
  if (player.user?.password && player.user?.emailVerified) {
    return NextResponse.json({ error: "Player already has an active account" }, { status: 400 });
  }

  // Create/find user if they don't have one yet
  if (!player.user) {
    const user = await prisma.user.upsert({
      where: { email: player.email },
      update: {},
      create: { name: player.name, email: player.email },
    });
    await prisma.player.update({ where: { id: playerId }, data: { userId: user.id } });
    await prisma.userLeagueRole.upsert({
      where: { userId_leagueId_role: { userId: user.id, leagueId: league.id, role: "PLAYER" } },
      update: {},
      create: { userId: user.id, leagueId: league.id, role: "PLAYER" },
    });
  }

  await sendPlayerInviteEmail(player.email, player.name, player.team.name, league.name);

  return NextResponse.json({ ok: true });
}
