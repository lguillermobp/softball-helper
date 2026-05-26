import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isMasterAdmin = (session.user as any).isMasterAdmin;

  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "email is required" }, { status: 400 });

  const target = await prisma.user.findUnique({ where: { email } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (target.emailVerified) {
    return NextResponse.json({ error: "Email already verified" }, { status: 400 });
  }

  // Only master admins or the user themselves can resend
  if (!isMasterAdmin && session.user.id !== target.id) {
    // Also allow league admins to resend for members of their leagues
    const sharedLeague = await prisma.userLeagueRole.findFirst({
      where: {
        leagueId: { in: await prisma.userLeagueRole
          .findMany({ where: { userId: session.user.id, role: "LEAGUE_ADMIN" } })
          .then((r) => r.map((x) => x.leagueId)) },
        userId: target.id,
      },
    });
    if (!sharedLeague) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await sendVerificationEmail(email, target.name);
  return NextResponse.json({ success: true });
}
