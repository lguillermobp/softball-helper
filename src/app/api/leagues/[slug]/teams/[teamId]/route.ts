import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendStaffInviteEmail, sendMemberInviteEmail } from "@/lib/email";

interface Params { params: Promise<{ slug: string; teamId: string }> }

interface StaffInput { name: string; email: string; phone?: string }

async function getAdminLeague(slug: string, userId: string, isMasterAdmin: boolean) {
  const league = await prisma.league.findUnique({
    where: { slug },
    include: { userRoles: { where: { userId } } },
  });
  if (!league) return null;
  const isAdmin = isMasterAdmin || league.userRoles.some((r) => r.role === "LEAGUE_ADMIN");
  return isAdmin ? league : null;
}

async function upsertStaff(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  leagueId: string,
  staff: StaffInput,
  role: "TEAM_MANAGER" | "TEAM_ASSISTANT"
) {
  let user = await tx.user.findUnique({ where: { email: staff.email } });
  const isNew = !user;

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

  return { user, isNew };
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, teamId } = await params;
  const league = await getAdminLeague(slug, session.user.id!, (session.user as any).isMasterAdmin);
  if (!league) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const team = await prisma.team.findFirst({ where: { id: teamId, leagueId: league.id } });
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const body = await req.json();

  // isActive-only toggle (deactivate / reactivate)
  if ("isActive" in body && Object.keys(body).length === 1) {
    const updated = await prisma.team.update({
      where: { id: teamId },
      data: { isActive: body.isActive },
    });
    return NextResponse.json(updated);
  }

  const { name, seasonId, categoryId, manager, assistant } = body;
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!manager?.name || !manager?.email)
    return NextResponse.json({ error: "Manager name and email are required" }, { status: 400 });

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

    return { updated, managerResult, assistantResult };
  });

  // Fire-and-forget emails for newly created users
  if (managerResult.isNew) {
    sendStaffInviteEmail(manager.email, manager.name, league.name, "TEAM_MANAGER").catch(
      (e) => console.error("[TEAMS PATCH] manager invite failed:", e)
    );
  }
  if (assistantResult?.isNew) {
    sendStaffInviteEmail(assistant.email, assistant.name, league.name, "TEAM_ASSISTANT").catch(
      (e) => console.error("[TEAMS PATCH] assistant invite failed:", e)
    );
  }

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, teamId } = await params;
  const league = await getAdminLeague(slug, session.user.id!, (session.user as any).isMasterAdmin);
  if (!league) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
