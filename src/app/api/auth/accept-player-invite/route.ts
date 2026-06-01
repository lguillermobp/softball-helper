import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createVerificationToken } from "@/lib/email";

const APP_URL = process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "http://localhost:3001";

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token");

  if (!token)
    return NextResponse.redirect(`${APP_URL}/login?error=invalid-token`);

  const record = await prisma.verificationToken.findUnique({ where: { token } });

  if (!record || record.expires < new Date() || !record.identifier.startsWith("player-invite:")) {
    if (record) await prisma.verificationToken.delete({ where: { token } });
    return NextResponse.redirect(`${APP_URL}/login?error=expired-token`);
  }

  const playerId = record.identifier.slice("player-invite:".length);

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { id: true, name: true, email: true, leagueId: true },
  });

  if (!player?.email) {
    await prisma.verificationToken.delete({ where: { token } });
    return NextResponse.redirect(`${APP_URL}/login?error=invalid-token`);
  }

  // Find or create user account for this email
  let user = await prisma.user.findUnique({ where: { email: player.email } });
  const needsPassword = !user?.password;

  if (!user) {
    user = await prisma.user.create({ data: { name: player.name, email: player.email } });
  }

  // Link player, grant PLAYER role, consume token — all in one transaction
  await prisma.$transaction([
    prisma.player.update({ where: { id: playerId }, data: { userId: user.id } }),
    prisma.userLeagueRole.upsert({
      where: { userId_leagueId_role: { userId: user.id, leagueId: player.leagueId, role: "PLAYER" } },
      update: {},
      create: { userId: user.id, leagueId: player.leagueId, role: "PLAYER" },
    }),
    prisma.verificationToken.delete({ where: { token } }),
  ]);

  // New or passwordless user → mark verified, redirect to set-password
  if (needsPassword) {
    await prisma.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } });
    const setToken = await createVerificationToken(player.email);
    return NextResponse.redirect(
      `${APP_URL}/set-password?token=${setToken}&email=${encodeURIComponent(player.email)}`
    );
  }

  // Existing verified user → go to dashboard
  return NextResponse.redirect(`${APP_URL}/dashboard`);
}
