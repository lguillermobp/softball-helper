import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ slug: string; teamId: string }> }

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, teamId } = await params;
  const userId = session.user.id!;
  const isMasterAdmin = (session.user as any).isMasterAdmin;

  const league = await prisma.league.findUnique({
    where: { slug },
    include: { userRoles: { where: { userId } } },
  });
  if (!league) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = isMasterAdmin || league.userRoles.some(r => r.role === "LEAGUE_ADMIN");

  const team = await prisma.team.findFirst({ where: { id: teamId, leagueId: league.id } });
  if (!team) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isStaff = team.managerId === userId || team.assistantId === userId;
  if (!isAdmin && !isStaff) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { published, description, showRoster, showStats, showSchedule, socialLinks } = await req.json();

  const page = await prisma.teamPublicPage.upsert({
    where: { teamId },
    update: { published, description, showRoster, showStats, showSchedule, socialLinks },
    create: { teamId, published, description, showRoster, showStats, showSchedule, socialLinks },
  });

  return NextResponse.json(page);
}
