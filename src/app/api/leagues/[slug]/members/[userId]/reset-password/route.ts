import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";

interface Params { params: Promise<{ slug: string; userId: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, userId } = await params;

  const league = await prisma.league.findUnique({
    where: { slug },
    include: { userRoles: { where: { userId: session.user.id } } },
  });
  if (!league) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isMasterAdmin = (session.user as any).isMasterAdmin;
  const isAdmin = isMasterAdmin || league.userRoles.some((r) => r.role === "LEAGUE_ADMIN");
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const membership = await prisma.userLeagueRole.findFirst({
    where: { leagueId: league.id, userId },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  if (!membership) return NextResponse.json({ error: "User not in league" }, { status: 404 });

  sendPasswordResetEmail(membership.user.email, membership.user.name).catch(
    (e) => console.error("[MEMBERS] password reset email failed:", e)
  );

  return NextResponse.json({ success: true });
}
