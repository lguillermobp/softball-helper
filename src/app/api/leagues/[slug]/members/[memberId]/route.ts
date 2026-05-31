import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

const ALLOWED_ROLES = ["LEAGUE_ADMIN", "UMPIRE", "SCOREKEEPER"];

interface Params { params: Promise<{ slug: string; memberId: string }> }

async function getLeagueAndCheck(slug: string, actorId: string, isMasterAdmin: boolean) {
  const league = await prisma.league.findUnique({
    where: { slug },
    include: { userRoles: { where: { userId: actorId } } },
  });
  if (!league) return null;
  const isAdmin = isMasterAdmin || league.userRoles.some((r) => r.role === "LEAGUE_ADMIN");
  return isAdmin ? league : null;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, memberId } = await params;
  const actorId      = session.user.id!;
  const isMasterAdmin = (session.user as any).isMasterAdmin;

  const league = await getLeagueAndCheck(slug, actorId, isMasterAdmin);
  if (!league) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const membership = await prisma.userLeagueRole.findFirst({
    where: { id: memberId, leagueId: league.id },
    include: { user: { select: { name: true, email: true } } },
  });
  if (!membership) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  const { role: newRole } = await req.json();
  if (!newRole || !ALLOWED_ROLES.includes(newRole))
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });

  if (newRole === membership.role)
    return NextResponse.json({ error: "Role is already set to that value" }, { status: 400 });

  // If changing away from LEAGUE_ADMIN, ensure at least one admin remains
  if (membership.role === "LEAGUE_ADMIN") {
    const adminCount = await prisma.userLeagueRole.count({
      where: { leagueId: league.id, role: "LEAGUE_ADMIN" },
    });
    if (adminCount <= 1)
      return NextResponse.json({ error: "Cannot change the role of the last league admin" }, { status: 400 });
  }

  const updated = await prisma.userLeagueRole.update({
    where: { id: memberId },
    data: { role: newRole },
  });

  await logAudit({
    actor: session.user as any,
    action: "member.role.change",
    entityType: "UserLeagueRole",
    entityId: memberId,
    leagueId: league.id,
    leagueName: league.name,
    metadata: { email: membership.user.email, oldRole: membership.role, newRole },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, memberId } = await params;
  const actorId      = session.user.id!;
  const isMasterAdmin = (session.user as any).isMasterAdmin;

  const league = await getLeagueAndCheck(slug, actorId, isMasterAdmin);
  if (!league) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const membership = await prisma.userLeagueRole.findFirst({
    where: { id: memberId, leagueId: league.id },
    include: { user: { select: { name: true, email: true } } },
  });
  if (!membership) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  // Prevent removing the last league admin
  if (membership.role === "LEAGUE_ADMIN") {
    const adminCount = await prisma.userLeagueRole.count({
      where: { leagueId: league.id, role: "LEAGUE_ADMIN" },
    });
    if (adminCount <= 1)
      return NextResponse.json({ error: "Cannot remove the last league admin" }, { status: 400 });
  }

  await prisma.userLeagueRole.delete({ where: { id: memberId } });

  await logAudit({
    actor: session.user as any,
    action: "member.remove",
    entityType: "UserLeagueRole",
    entityId: memberId,
    leagueId: league.id,
    leagueName: league.name,
    metadata: { email: membership.user.email, role: membership.role },
  });

  return NextResponse.json({ success: true });
}
