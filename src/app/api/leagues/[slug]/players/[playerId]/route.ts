import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPlayerAcceptInviteEmail } from "@/lib/email";
import { logAudit, getRequestMeta } from "@/lib/audit";

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
  const dob: Date | null | undefined = "dob" in body ? (body.dob ? new Date(body.dob) : null) : undefined;

  const emailChanging = email !== undefined && email !== player.email;

  // Block if new email is already used by another player in this league
  if (emailChanging && email) {
    const conflict = await prisma.player.findFirst({
      where: { email, leagueId: league.id, id: { not: playerId } },
    });
    if (conflict)
      return NextResponse.json({ error: "This email is already registered as a player in this league" }, { status: 409 });
  }

  const updated = await prisma.player.update({
    where: { id: playerId },
    data: {
      ...(name        !== undefined && { name }),
      ...(email       !== undefined && { email }),
      // Reset account link when email changes — re-confirmed via accept-invite
      ...(emailChanging            && { userId: null }),
      ...(jerseyNumber !== undefined && { jerseyNumber: jerseyNumber || null }),
      ...(nationality  !== undefined && { nationality }),
      ...(dob          !== undefined && { dob }),
    },
  });

  // Send accept-invite when email is set or changed to a non-null value
  if (emailChanging && email) {
    sendPlayerAcceptInviteEmail(email, updated.name, player.team.name, league.name, playerId).catch(
      (e) => console.error("[PLAYERS] accept-invite failed:", e)
    );
  }

  await logAudit({
    actor: session.user as any, action: "player.update",
    entityType: "Player", entityId: playerId,
    leagueId: league.id, leagueName: league.name,
    metadata: { name, email },
    ...getRequestMeta(req),
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: Params) {
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
    include: { team: { select: { managerId: true, name: true } } },
  });
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  if (!isLeagueAdmin) {
    const isManager = player.team.managerId === userId;
    if (!isManager) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.player.update({ where: { id: playerId }, data: { isActive: false } });

  await logAudit({
    actor: session.user as any, action: "player.remove",
    entityType: "Player", entityId: playerId,
    leagueId: league.id, leagueName: league.name,
    metadata: { name: player.name, team: player.team.name },
    ...getRequestMeta(req),
  });
  return NextResponse.json({ success: true });
}
