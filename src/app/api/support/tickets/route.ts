import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendNewTicketToAssignee, sendNewTicketToLeagueAdmin } from "@/lib/email";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  if (user.isMasterAdmin || user.isSupportTechnician)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { title, body, category, leagueId } = await req.json();
  if (!title?.trim() || !body?.trim() || !["LEAGUE_ISSUE", "SYSTEM_ISSUE"].includes(category))
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  // Resolve the league for context
  const league = leagueId
    ? await prisma.league.findUnique({
        where: { id: leagueId },
        include: {
          technician: true,
          userRoles: { where: { role: "LEAGUE_ADMIN" }, include: { user: true } },
        },
      })
    : null;

  // Determine assignee: league technician → master admin fallback
  let assignedTo: { id: string; email: string; name: string | null } | null = null;

  if (league?.technician) {
    assignedTo = { id: league.technician.id, email: league.technician.email, name: league.technician.name };
  } else {
    const masterAdmin = await prisma.user.findFirst({ where: { isMasterAdmin: true, isActive: true } });
    if (masterAdmin) assignedTo = { id: masterAdmin.id, email: masterAdmin.email, name: masterAdmin.name };
  }

  const ticket = await prisma.ticket.create({
    data: {
      title: title.trim(),
      body: body.trim(),
      category,
      leagueId: league?.id ?? null,
      createdById: user.id,
      assignedToId: assignedTo?.id ?? null,
    },
  });

  const creator = await prisma.user.findUnique({ where: { id: user.id } });

  // Fire-and-forget notifications
  if (assignedTo) {
    sendNewTicketToAssignee({
      toEmail: assignedTo.email,
      toName: assignedTo.name,
      ticketId: ticket.id,
      title: ticket.title,
      body: ticket.body,
      category: category === "LEAGUE_ISSUE" ? "League Issue" : "System Issue",
      leagueName: league?.name ?? null,
      creatorName: creator?.name ?? user.email,
      creatorEmail: creator?.email ?? user.email,
    }).catch(e => console.error("[TICKET] assignee email failed:", e));
  }

  if (category === "LEAGUE_ISSUE" && league) {
    for (const role of league.userRoles) {
      sendNewTicketToLeagueAdmin({
        toEmail: role.user.email,
        toName: role.user.name,
        ticketId: ticket.id,
        title: ticket.title,
        body: ticket.body,
        leagueName: league.name,
        creatorName: creator?.name ?? user.email,
        creatorEmail: creator?.email ?? user.email,
      }).catch(e => console.error("[TICKET] league admin email failed:", e));
    }
  }

  return NextResponse.json(ticket, { status: 201 });
}
