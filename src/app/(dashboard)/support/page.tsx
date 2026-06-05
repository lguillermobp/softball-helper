import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SupportDashboardView } from "@/components/support/SupportDashboardView";

export const dynamic = "force-dynamic";

export default async function SupportDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user as any;
  if (!user.isMasterAdmin && !user.isSupportTechnician) redirect("/dashboard");

  const tickets = await prisma.ticket.findMany({
    include: {
      league: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      _count: { select: { messages: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const technicians = user.isMasterAdmin
    ? await prisma.user.findMany({
        where: { OR: [{ isSupportTechnician: true }, { isMasterAdmin: true }], isActive: true },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      })
    : [];

  const serialized = tickets.map(t => ({
    id: t.id, title: t.title, category: t.category, status: t.status,
    createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString(),
    league: t.league,
    createdBy: t.createdBy,
    assignedTo: t.assignedTo,
    _count: t._count,
  }));

  return (
    <SupportDashboardView
      tickets={serialized}
      technicians={technicians}
      isMasterAdmin={user.isMasterAdmin}
    />
  );
}
