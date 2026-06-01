import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPlayerInviteEmail, sendRoleNotificationEmail } from "@/lib/email";
import { logAudit } from "@/lib/audit";

interface Params { params: Promise<{ slug: string; playerId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
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

  const isLeagueAdmin = isMasterAdmin || league.userRoles.some((r) => r.role === "LEAGUE_ADMIN");

  const player = await prisma.player.findFirst({
    where: { id: playerId, leagueId: league.id },
    include: { team: { select: { id: true, name: true, status: true, managerId: true, assistantId: true } } },
  });
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  if (!isLeagueAdmin) {
    const isStaff = player.team.managerId === userId || player.team.assistantId === userId;
    if (!isStaff || player.team.status !== "PENDING")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { name, jerseyNumber } = body;
  const email: string | null | undefined = "email" in body ? ((body.email as string | undefined)?.trim() || null) : undefined;
  const nationality: string | null | undefined = "nationality" in body ? (body.nationality || null) : undefined;

  // Duplicate email check within the same team
  if (email && email !== player.email) {
    const conflict = await prisma.player.findUnique({
      where: { email_teamId: { email, teamId: player.teamId } },
    });
    if (conflict && conflict.id !== playerId)
      return NextResponse.json({ error: "A player with this email already exists in the team" }, { status: 409 });
  }

  // When email is being set or changed, wire up the user account and send email
  let newUserId: string | undefined;
  let pendingEmail: (() => void) | null = null;

  if (email && email !== player.email) {
    let user = await prisma.user.findUnique({ where: { email } });
    const isNew = !user;
    const wasVerified = !isNew && !!user!.emailVerified;

    if (!user) {
      user = await prisma.user.create({ data: { name: name ?? player.name, email } });
    }
    newUserId = user.id;

    await prisma.userLeagueRole.upsert({
      where: { userId_leagueId_role: { userId: user.id, leagueId: league.id, role: "PLAYER" } },
      update: {},
      create: { userId: user.id, leagueId: league.id, role: "PLAYER" },
    });

    if (isNew) {
      pendingEmail = () =>
        sendPlayerInviteEmail(email, name ?? player.name, player.team.name, league.name)
          .catch((e) => console.error("[PLAYERS] invite failed:", e));
    } else if (wasVerified) {
      pendingEmail = () =>
        sendRoleNotificationEmail(email, user!.name, league.name, `player in ${player.team.name}`)
          .catch((e) => console.error("[PLAYERS] notification failed:", e));
    }
  }

  const updated = await prisma.player.update({
    where: { id: playerId },
    data: {
      ...(name        !== undefined && { name }),
      ...(email       !== undefined && { email }),
      ...(newUserId   !== undefined && { userId: newUserId }),
      ...(jerseyNumber !== undefined && { jerseyNumber: jerseyNumber || null }),
      ...(nationality !== undefined && { nationality }),
    },
  });

  pendingEmail?.();

  await logAudit({
    actor: session.user as any, action: "player.update",
    entityType: "Player", entityId: playerId,
    leagueId: league.id, leagueName: league.name,
    metadata: { name, email },
  });
  return NextResponse.json(updated);
}
