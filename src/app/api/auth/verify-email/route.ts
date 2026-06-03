import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const APP_URL = process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "http://localhost:3001";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const email = searchParams.get("email");

  if (!token || !email) {
    return NextResponse.redirect(`${APP_URL}/login?error=invalid-token`);
  }

  const record = await prisma.verificationToken.findUnique({ where: { token } });

  if (!record || record.identifier !== email || record.expires < new Date()) {
    await prisma.verificationToken.deleteMany({ where: { token } });
    return NextResponse.redirect(`${APP_URL}/login?error=expired-token`);
  }

  const user = await prisma.user.update({
    where: { email },
    data: { emailVerified: new Date() },
    select: { password: true },
  });

  if (!user.password) {
    // User has no password yet (admin-created account).
    // Do NOT consume the token here — email security scanners follow every link
    // in emails before the user sees them, which would delete the token and leave
    // the user unable to reach set-password. Instead keep the token alive and let
    // set-password consume it when the user actually submits the form.
    return NextResponse.redirect(
      `${APP_URL}/set-password?token=${token}&email=${encodeURIComponent(email)}`
    );
  }

  // User already has a password (e.g. re-verification after email change).
  // Token is no longer needed — consume it and send them to login.
  await prisma.verificationToken.delete({ where: { token } });
  return NextResponse.redirect(`${APP_URL}/login?verified=1`);
}
