import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createVerificationToken } from "@/lib/email";

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
  await prisma.verificationToken.delete({ where: { token } });

  // Admin-created users have no password — send them to set one
  if (!user.password) {
    const setToken = await createVerificationToken(email);
    return NextResponse.redirect(
      `${APP_URL}/set-password?token=${setToken}&email=${encodeURIComponent(email)}`
    );
  }

  return NextResponse.redirect(`${APP_URL}/login?verified=1`);
}
