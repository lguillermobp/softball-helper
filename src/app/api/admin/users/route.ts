import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!(session?.user as any)?.isMasterAdmin)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";

  const users = await prisma.user.findMany({
    where: q
      ? {
          OR: [
            { name:  { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    select: {
      id: true, name: true, email: true, phone: true,
      emailVerified: true, isMasterAdmin: true, isActive: true, createdAt: true,
      _count: { select: { leagueRoles: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(users);
}
