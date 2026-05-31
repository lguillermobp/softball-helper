import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendStaffInviteEmail, sendMemberInviteEmail, sendRoleNotificationEmail } from "@/lib/email";

interface Params { params: Promise<{ slug: string; teamId: string }> }

interface StaffInput { name: string; email: string; phone?: string }

async function getLeagueWithRole(slug: string, userId: string) {
  return prisma.league.findUnique({
    where: { slug },
    include: { userRoles: { where: { userId } } },
  });
}

function isLeagueAdmin(league: NonNullable<Awaited<ReturnType<typeof getLeagueWithRole>>>, isMasterAdmin: boolean) {
  return isMasterAdmin || league.userRoles.some((r) => r.role === "LEAGUE_ADMIN");
}

async function upsertStaff(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  leagueId: string,
  staff: StaffInput,
  role: "TEAM_MANAGER" | "TEAM_ASSISTANT"
) {
  let user = await tx.user.findUnique({ where: { email: staff.email } });
  const isNew = !user;
  const wasVerified = !isNew && !!user!.emailVerified;

  if (!user) {
    user = await tx.user.create({
      data: { name: staff.name, email: staff.email, phone: staff.phone ?? null },
    });
  } else if (staff.phone && !user.phone) {
    user = await tx.user.update({ where: { id: user.id }, data: { phone: staff.phone } });
  }

  await tx.userLeagueRole.upsert({
    where: { userId_leagueId_role: { userId: user.id, leagueId, role } },
    update: {},
    create: { userId: user.id, leagueId, role },
  });

  return { user, isNew, wasVerified };
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, teamId } = await params;
  const userId = session.user.id!;
  const isMasterAdmin = (session.user as any).isMasterAdmin;

  const league = await getLeagueWithRole(slug, userId);
  if (!league) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const admin = isLeagueAdmin(league, isMasterAdmin);

  const team = await prisma.team.findFirst({ where: { id: teamId, leagueId: league.id } });
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const body = await req.json();

  // isActive-only toggle — admin only
  if ("isActive" in body && Object.keys(body).length === 1) {
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const updated = await prisma.team.update({ where: { id: teamId }, data: { isActive: body.isActive } });
    return NextResponse.json(updated);
  }

  // group-only update — admin only
  if ("group" in body && Object.keys(body).length === 1) {
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const updated = await prisma.team.update({
      where: { id: teamId },
      data: { group: body.group || null },
    });
    return NextResponse.json(updated);
  }

  // status-only toggle (approve / unapprove) — admin only
  if ("status" in body && Object.keys(body).length === 1) {
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (body.status !== "PENDING" && body.status !== "APPROVED")
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    const updated = await prisma.team.update({ where: { id: teamId }, data: { status: body.status } });
    return NextResponse.json(updated);
  }

  // Full edit — admin always; manager/assistant only when team is PENDING
  const isStaff = team.managerId === userId || team.assistantId === userId;
  const canEdit = admin || (isStaff && team.status === "PENDING");
  if (!canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, seasonId, categoryId, manager, assistant } = body;
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!manager?.name || !manager?.email)
    return NextResponse.json({ error: "Manager name and email are required" }, { status: 400 });

  const oldManagerId = team.managerId;
  const oldAssistantId = team.assistantId;

  const { updated, managerResult, assistantResult } = await prisma.$transaction(async (tx) => {
    const managerResult = await upsertStaff(tx, league.id, manager, "TEAM_MANAGER");
    const assistantResult =
      assistant?.name && assistant?.email
        ? await upsertStaff(tx, league.id, assistant, "TEAM_ASSISTANT")
        : null;

    const updated = await tx.team.update({
      where: { id: teamId },
      data: {
        name,
        seasonId: seasonId || null,
        categoryId: categoryId || null,
        managerId: managerResult.user.id,
        assistantId: assistantResult?.user.id ?? null,
      },
    });

    // Upsert player record for new manager so they appear in the lineup
    await tx.player.upsert({
      where: { email_teamId: { email: manager.email, teamId } },
      update: { name: manager.name, userId: managerResult.user.id },
      create: { name: manager.name, email: manager.email, teamId, leagueId: league.id, userId: managerResult.user.id },
    });

    // Remove old manager's TEAM_MANAGER role if they no longer manage any team in this league
    if (oldManagerId && oldManagerId !== managerResult.user.id) {
      const stillManages = await tx.team.findFirst({
        where: { leagueId: league.id, id: { not: teamId }, OR: [{ managerId: oldManagerId }, { assistantId: oldManagerId }] },
      });
      if (!stillManages) {
        await tx.userLeagueRole.deleteMany({ where: { userId: oldManagerId, leagueId: league.id, role: "TEAM_MANAGER" } });
      }
    }

    // Remove old assistant's TEAM_ASSISTANT role if they no longer assist any team in this league
    if (oldAssistantId && oldAssistantId !== (assistantResult?.user.id ?? null)) {
      const stillAssists = await tx.team.findFirst({
        where: { leagueId: league.id, id: { not: teamId }, OR: [{ managerId: oldAssistantId }, { assistantId: oldAssistantId }] },
      });
      if (!stillAssists) {
        await tx.userLeagueRole.deleteMany({ where: { userId: oldAssistantId, leagueId: league.id, role: "TEAM_ASSISTANT" } });
      }
    }

    return { updated, managerResult, assistantResult };
  });

  // Fire-and-forget emails
  if (managerResult.isNew) {
    sendStaffInviteEmail(manager.email, manager.name, league.name, "TEAM_MANAGER").catch(
      (e) => console.error("[TEAMS PATCH] manager invite failed:", e)
    );
  } else if (!managerResult.wasVerified) {
    sendMemberInviteEmail(manager.email, league.name, "TEAM_MANAGER").catch(
      (e) => console.error("[TEAMS PATCH] manager verify failed:", e)
    );
  } else {
    sendRoleNotificationEmail(manager.email, managerResult.user.name, league.name, "team manager").catch(
      (e) => console.error("[TEAMS PATCH] manager notification failed:", e)
    );
  }

  if (assistantResult) {
    if (assistantResult.isNew) {
      sendStaffInviteEmail(assistant.email, assistant.name, league.name, "TEAM_ASSISTANT").catch(
        (e) => console.error("[TEAMS PATCH] assistant invite failed:", e)
      );
    } else if (!assistantResult.wasVerified) {
      sendMemberInviteEmail(assistant.email, league.name, "TEAM_ASSISTANT").catch(
        (e) => console.error("[TEAMS PATCH] assistant verify failed:", e)
      );
    } else {
      sendRoleNotificationEmail(assistant.email, assistantResult.user.name, league.name, "team assistant").catch(
        (e) => console.error("[TEAMS PATCH] assistant notification failed:", e)
      );
    }
  }

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, teamId } = await params;
  const userId = session.user.id!;
  const isMasterAdmin = (session.user as any).isMasterAdmin;

  const league = await getLeagueWithRole(slug, userId);
  if (!league) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isLeagueAdmin(league, isMasterAdmin)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const team = await prisma.team.findFirst({ where: { id: teamId, leagueId: league.id } });
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const gameCount = await prisma.game.count({
    where: { OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
  });
  if (gameCount > 0)
    return NextResponse.json(
      { error: `Cannot delete: this team has ${gameCount} game(s) in the schedule.` },
      { status: 409 }
    );

  await prisma.team.delete({ where: { id: teamId } });
  return NextResponse.json({ success: true });
}
