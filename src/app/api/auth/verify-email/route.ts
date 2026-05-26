import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createVerificationToken } from "@/lib/email";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const email = searchParams.get("email");

  if (!token || !email) {
    return NextResponse.redirect(new URL("/login?error=invalid-token", req.url));
  }

  const record = await prisma.verificationToken.findUnique({ where: { token } });

  if (!record || record.identifier !== email || record.expires < new Date()) {
    await prisma.verificationToken.deleteMany({ where: { token } });
    return NextResponse.redirect(new URL("/login?error=expired-token", req.url));
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
      new URL(`/set-password?token=${setToken}&email=${encodeURIComponent(email)}`, req.url)
    );
  }

  return NextResponse.redirect(new URL("/login?verified=1", req.url));
}
