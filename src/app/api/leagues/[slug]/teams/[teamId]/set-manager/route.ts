import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendStaffInviteEmail, sendMemberInviteEmail, sendRoleNotificationEmail } from "@/lib/email";

interface Params { params: Promise<{ slug: string; teamId: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const { slug, teamId } = await params;
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

  const team = await prisma.team.findFirst({ where: { id: teamId, leagueId: league.id } });
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const { name, email, phone, managerRole } = await req.json();
  if (!name?.trim() || !email?.trim())
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 });

  const resolvedRole: "TEAM_MANAGER" | "TEAM_MANAGER_PLAYER" =
    managerRole === "TEAM_MANAGER_PLAYER" ? "TEAM_MANAGER_PLAYER" : "TEAM_MANAGER";

  // Find or create the user
  let user = await prisma.user.findUnique({ where: { email } });
  const isNew = !user;
  const wasVerified = !isNew && !!user!.emailVerified;

  if (!user) {
    user = await prisma.user.create({
      data: { name: name.trim(), email: email.trim(), phone: phone || null },
    });
  } else if (phone && !user.phone) {
    user = await prisma.user.update({ where: { id: user.id }, data: { phone } });
  }

  await prisma.$transaction(async tx => {
    // Assign role
    await tx.userLeagueRole.upsert({
      where: { userId_leagueId_role: { userId: user!.id, leagueId: league.id, role: resolvedRole } },
      update: {},
      create: { userId: user!.id, leagueId: league.id, role: resolvedRole },
    });

    // Set as team manager
    await tx.team.update({ where: { id: teamId }, data: { managerId: user!.id } });

    // If playing role, auto-add to roster
    if (resolvedRole === "TEAM_MANAGER_PLAYER") {
      await tx.player.upsert({
        where: { email_teamId: { email: email.trim(), teamId } },
        update: { name: name.trim(), userId: user!.id },
        create: { name: name.trim(), email: email.trim(), teamId, leagueId: league.id, userId: user!.id },
      });
    }
  });

  // Fire-and-forget invite email
  if (isNew) {
    sendStaffInviteEmail(email, name, league.name, "TEAM_MANAGER").catch(
      e => console.error("[SET_MANAGER] invite failed:", e)
    );
  } else if (!wasVerified) {
    sendMemberInviteEmail(email, league.name, "TEAM_MANAGER").catch(
      e => console.error("[SET_MANAGER] verify failed:", e)
    );
  } else {
    sendRoleNotificationEmail(email, user.name, league.name, "team manager").catch(
      e => console.error("[SET_MANAGER] notification failed:", e)
    );
  }

  return NextResponse.json({ ok: true, userId: user.id });
}
