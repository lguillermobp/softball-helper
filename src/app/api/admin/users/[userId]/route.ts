import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email";

interface Params { params: Promise<{ userId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!(session?.user as any)?.isMasterAdmin)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId } = await params;
  const body = await req.json();
  const { name, phone, email, isActive } = body;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const emailChanged = email && email !== user.email;

  if (emailChanged) {
    const conflict = await prisma.user.findUnique({ where: { email } });
    if (conflict && conflict.id !== userId)
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(name  !== undefined && { name }),
      ...(phone !== undefined && { phone }),
      ...(email !== undefined && { email }),
      ...(emailChanged        && { emailVerified: null }),
      ...(isActive !== undefined && { isActive }),
    },
    select: {
      id: true, name: true, email: true, phone: true,
      emailVerified: true, isMasterAdmin: true, isActive: true, createdAt: true,
      _count: { select: { leagueRoles: true } },
    },
  });

  if (emailChanged) {
    sendVerificationEmail(updated.email, updated.name).catch(
      (e) => console.error("[ADMIN] re-verification email failed:", e)
    );
  }

  return NextResponse.json(updated);
}
