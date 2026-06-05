import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendTicketReplyNotification } from "@/lib/email";

interface Params { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
    },
  });
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Access: creator, assignee, master admin, any support technician
  const isCreator    = ticket.createdById === user.id;
  const isAssignee   = ticket.assignedToId === user.id;
  const isTech       = user.isSupportTechnician || user.isMasterAdmin;
  if (!isCreator && !isAssignee && !isTech)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (ticket.status === "CLOSED")
    return NextResponse.json({ error: "Ticket is closed" }, { status: 400 });

  const { body } = await req.json();
  if (!body?.trim()) return NextResponse.json({ error: "Message body required" }, { status: 400 });

  const author = await prisma.user.findUnique({ where: { id: user.id } });

  const message = await prisma.ticketMessage.create({
    data: { ticketId: id, authorId: user.id, body: body.trim() },
    include: { author: { select: { id: true, name: true, email: true, isSupportTechnician: true, isMasterAdmin: true } } },
  });

  // Auto-move to IN_PROGRESS when assignee first replies
  if ((isAssignee || isTech) && ticket.status === "OPEN") {
    await prisma.ticket.update({ where: { id }, data: { status: "IN_PROGRESS" } });
  }

  // Notify the other party (fire-and-forget)
  const authorName = author?.name ?? author?.email ?? "Support";
  if (isCreator) {
    // Notify assignee
    if (ticket.assignedTo) {
      sendTicketReplyNotification({
        toEmail: ticket.assignedTo.email,
        ticketId: id,
        ticketTitle: ticket.title,
        replyAuthorName: authorName,
        replyBody: body.trim(),
      }).catch(e => console.error("[TICKET_MSG] assignee notify failed:", e));
    }
  } else {
    // Notify creator
    sendTicketReplyNotification({
      toEmail: ticket.createdBy.email,
      ticketId: id,
      ticketTitle: ticket.title,
      replyAuthorName: authorName,
      replyBody: body.trim(),
    }).catch(e => console.error("[TICKET_MSG] creator notify failed:", e));
  }

  return NextResponse.json(message, { status: 201 });
}
