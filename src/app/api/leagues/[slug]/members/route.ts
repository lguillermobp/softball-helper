import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  const { email, role } = await req.json();
  if (!email || !role)
    return NextResponse.json({ error: "email and role are required" }, { status: 400 });

  const targetUser = await prisma.user.findUnique({ where: { email } });
  if (!targetUser)
    return NextResponse.json(
      { error: `No account found for ${email}. They must register first.` },
      { status: 404 }
    );

  // Upsert so calling twice is safe
  const membership = await prisma.userLeagueRole.upsert({
    where: { userId_leagueId_role: { userId: targetUser.id, leagueId: league.id, role } },
    update: {},
    create: { userId: targetUser.id, leagueId: league.id, role },
  });

  return NextResponse.json(membership, { status: 201 });
}
