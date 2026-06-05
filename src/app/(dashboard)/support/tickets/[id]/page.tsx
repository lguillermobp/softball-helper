import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TicketDetailView } from "@/components/support/TicketDetailView";

interface PageProps { params: Promise<{ id: string }> }

export default async function TicketDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

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

  if (!ticket) notFound();

  const isMasterAdmin       = user.isMasterAdmin as boolean;
  const isSupportTechnician = user.isSupportTechnician as boolean;
  const isCreator           = ticket.createdById === user.id;
  const isAssignee          = ticket.assignedToId === user.id;

  if (!isMasterAdmin && !isSupportTechnician && !isCreator && !isAssignee) redirect("/dashboard");

  // Technician list for transfer (master admin only)
  const technicians = isMasterAdmin
    ? await prisma.user.findMany({
        where: { OR: [{ isSupportTechnician: true }, { isMasterAdmin: true }], isActive: true },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      })
    : [];

  const backHref = isMasterAdmin || isSupportTechnician ? "/support" : "/support/tickets";

  return (
    <TicketDetailView
      ticket={{
        ...ticket,
        createdAt: ticket.createdAt.toISOString(),
        updatedAt: ticket.updatedAt.toISOString(),
        messages: ticket.messages.map(m => ({ ...m, createdAt: m.createdAt.toISOString() })),
      }}
      currentUserId={user.id}
      isMasterAdmin={isMasterAdmin}
      isSupportTechnician={isSupportTechnician}
      technicians={technicians}
      backHref={backHref}
    />
  );
}
