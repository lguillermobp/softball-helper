import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendMemberInviteEmail } from "@/lib/email";

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

  // Players are managed via the /players endpoint, not as league members
  if (role === "PLAYER")
    return NextResponse.json({ error: "Players are added per team, not as members" }, { status: 400 });

  const targetUser = await prisma.user.findUnique({ where: { email } });
  if (!targetUser)
    return NextResponse.json(
      { error: `No account found for ${email}. They must register first.` },
      { status: 404 }
    );

  const membership = await prisma.userLeagueRole.upsert({
    where: { userId_leagueId_role: { userId: targetUser.id, leagueId: league.id, role } },
    update: {},
    create: { userId: targetUser.id, leagueId: league.id, role },
  });

  // Send verification email if not yet verified
  if (!targetUser.emailVerified) {
    sendMemberInviteEmail(email, league.name, role).catch((e) =>
      console.error("[MEMBERS] invite email failed:", e)
    );
  }

  return NextResponse.json(membership, { status: 201 });
}
