import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ slug: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  if (!user.isMasterAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const league = await prisma.league.findUnique({ where: { slug } });
  if (!league) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { technicianId } = await req.json();

  if (technicianId) {
    const tech = await prisma.user.findUnique({ where: { id: technicianId } });
    if (!tech?.isSupportTechnician && !tech?.isMasterAdmin)
      return NextResponse.json({ error: "User is not a support technician" }, { status: 400 });
  }

  const updated = await prisma.league.update({
    where: { id: league.id },
    data: { technicianId: technicianId ?? null },
    include: { technician: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json({ technician: updated.technician });
}
