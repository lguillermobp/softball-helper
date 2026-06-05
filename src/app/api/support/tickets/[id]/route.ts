import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ id: string }> }

function canAccess(user: any, ticket: { createdById: string; assignedToId: string | null }) {
  if (user.isMasterAdmin || user.isSupportTechnician) return true;
  if (ticket.createdById === user.id) return true;
  if (ticket.assignedToId === user.id) return true;
  return false;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      league: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      messages: {
        include: { author: { select: { id: true, name: true, email: true, isSupportTechnician: true, isMasterAdmin: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccess(user, ticket)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json(ticket);
}

// Transfer ticket (master admin only) or update status (master admin / technician / assignee)
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccess(user, ticket)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { status, assignedToId } = await req.json();

  // Only master admin can transfer
  if (assignedToId !== undefined && !user.isMasterAdmin)
    return NextResponse.json({ error: "Only master admin can transfer tickets" }, { status: 403 });

  if (assignedToId !== undefined) {
    const target = await prisma.user.findUnique({ where: { id: assignedToId } });
    if (!target?.isSupportTechnician && !target?.isMasterAdmin)
      return NextResponse.json({ error: "Target must be a support technician or master admin" }, { status: 400 });
  }

  const updated = await prisma.ticket.update({
    where: { id },
    data: {
      ...(status ? { status } : {}),
      ...(assignedToId !== undefined ? { assignedToId } : {}),
    },
  });

  return NextResponse.json(updated);
}
