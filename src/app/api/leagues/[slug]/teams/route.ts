import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendStaffInviteEmail, sendMemberInviteEmail, sendRoleNotificationEmail } from "@/lib/email";
import { logAudit } from "@/lib/audit";

interface Params { params: Promise<{ slug: string }> }

interface StaffInput { name: string; email: string; phone?: string }

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

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const league = await prisma.league.findUnique({
    where: { slug },
    include: { userRoles: { where: { userId: session.user.id } } },
  });
  if (!league) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isMasterAdmin = (session.user as any).isMasterAdmin;
  const isAdmin = isMasterAdmin || league.userRoles.some((r) => r.role === "LEAGUE_ADMIN");
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, seasonId, categoryId, manager, assistant } = await req.json();
  if (!name)
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!manager?.name || !manager?.email)
    return NextResponse.json({ error: "Manager name and email are required" }, { status: 400 });

  const { team, managerResult, assistantResult } = await prisma.$transaction(async (tx) => {
    const managerResult = await upsertStaff(tx, league.id, manager, "TEAM_MANAGER");
    const assistantResult =
      assistant?.name && assistant?.email
        ? await upsertStaff(tx, league.id, assistant, "TEAM_ASSISTANT")
        : null;

    const team = await tx.team.create({
      data: {
        leagueId: league.id,
        name,
        seasonId: seasonId || null,
        categoryId: categoryId || null,
        managerId: managerResult.user.id,
        assistantId: assistantResult?.user.id ?? null,
      },
    });

    // Automatically add the manager as a player on their team
    await tx.player.upsert({
      where: { email_teamId: { email: manager.email, teamId: team.id } },
      update: { name: manager.name, userId: managerResult.user.id },
      create: {
        name: manager.name,
        email: manager.email,
        teamId: team.id,
        leagueId: league.id,
        userId: managerResult.user.id,
      },
    });

    return { team, managerResult, assistantResult };
  });

  // Fire-and-forget emails
  if (managerResult.isNew) {
    sendStaffInviteEmail(manager.email, manager.name, league.name, "TEAM_MANAGER").catch(
      (e) => console.error("[TEAMS] manager invite failed:", e)
    );
  } else if (!managerResult.wasVerified) {
    sendMemberInviteEmail(manager.email, league.name, "TEAM_MANAGER").catch(
      (e) => console.error("[TEAMS] manager verify failed:", e)
    );
  } else {
    sendRoleNotificationEmail(manager.email, managerResult.user.name, league.name, "team manager").catch(
      (e) => console.error("[TEAMS] manager notification failed:", e)
    );
  }

  if (assistantResult) {
    if (assistantResult.isNew) {
      sendStaffInviteEmail(assistant.email, assistant.name, league.name, "TEAM_ASSISTANT").catch(
        (e) => console.error("[TEAMS] assistant invite failed:", e)
      );
    } else if (!assistantResult.wasVerified) {
      sendMemberInviteEmail(assistant.email, league.name, "TEAM_ASSISTANT").catch(
        (e) => console.error("[TEAMS] assistant verify failed:", e)
      );
    } else {
      sendRoleNotificationEmail(assistant.email, assistantResult.user.name, league.name, "team assistant").catch(
        (e) => console.error("[TEAMS] assistant notification failed:", e)
      );
    }
  }

  await logAudit({ actor: session.user as any, action: "team.create", entityType: "Team", entityId: team.id, leagueId: league.id, leagueName: league.name, metadata: { name: team.name } });
  return NextResponse.json(team, { status: 201 });
}
