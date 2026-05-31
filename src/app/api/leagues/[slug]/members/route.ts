import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  sendStaffInviteEmail,
  sendMemberInviteEmail,
  sendRoleNotificationEmail,
} from "@/lib/email";
import { logAudit } from "@/lib/audit";

interface Params { params: Promise<{ slug: string }> }

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

  const { name, email, role } = await req.json();
  if (!email || !role)
    return NextResponse.json({ error: "email and role are required" }, { status: 400 });

  if (role === "PLAYER")
    return NextResponse.json({ error: "Players are added per team, not as members" }, { status: 400 });

  if (role === "TEAM_MANAGER" || role === "TEAM_ASSISTANT")
    return NextResponse.json({ error: "Team Manager and Team Assistant are assigned when creating or editing a team" }, { status: 400 });

  // Look up or create the user
  let user = await prisma.user.findUnique({ where: { email } });
  const isNew = !user;
  const wasVerified = !isNew && !!user!.emailVerified;

  if (!user) {
    if (!name) return NextResponse.json({ error: "Full name is required for new users" }, { status: 400 });
    user = await prisma.user.create({ data: { name, email } });
  }

  const membership = await prisma.userLeagueRole.upsert({
    where: { userId_leagueId_role: { userId: user.id, leagueId: league.id, role } },
    update: {},
    create: { userId: user.id, leagueId: league.id, role },
  });

  const roleLabel = role.replace(/_/g, " ").toLowerCase();

  if (isNew) {
    sendStaffInviteEmail(email, name!, league.name, role).catch(
      (e) => console.error("[MEMBERS] invite failed:", e)
    );
  } else if (!wasVerified) {
    sendMemberInviteEmail(email, league.name, role).catch(
      (e) => console.error("[MEMBERS] verify email failed:", e)
    );
  } else {
    sendRoleNotificationEmail(email, user.name, league.name, roleLabel).catch(
      (e) => console.error("[MEMBERS] notification failed:", e)
    );
  }

  await logAudit({ actor: session.user as any, action: "member.add", entityType: "UserLeagueRole", entityId: membership.id, leagueId: league.id, leagueName: league.name, metadata: { email, role } });
  return NextResponse.json(membership, { status: 201 });
}
