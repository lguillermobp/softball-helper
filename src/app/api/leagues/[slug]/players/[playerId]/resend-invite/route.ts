import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPlayerAcceptInviteEmail, sendPlayerInviteEmail } from "@/lib/email";
import { logAudit } from "@/lib/audit";

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
    (r) => r.role === "LEAGUE_ADMIN" || r.role === "TEAM_MANAGER" || r.role === "TEAM_MANAGER_PLAYER"
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

  if (player.user?.password && player.user?.emailVerified)
    return NextResponse.json({ error: "Player already has an active account" }, { status: 400 });

  if (!player.userId) {
    // New deferred-link flow: player hasn't confirmed yet — resend accept-invite
    await sendPlayerAcceptInviteEmail(player.email, player.name, player.team.name, league.name, playerId);
  } else {
    // Legacy: userId already set but account incomplete (e.g. manager auto-added as player)
    await sendPlayerInviteEmail(player.email, player.name, player.team.name, league.name);
  }

  await logAudit({
    actor: session.user as any, action: "player.invite.resend",
    entityType: "Player", entityId: playerId,
    leagueId: league.id, leagueName: league.name,
    metadata: { playerName: player.name, email: player.email },
  });
  return NextResponse.json({ ok: true });
}
