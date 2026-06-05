import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { MyTicketsView } from "@/components/support/MyTicketsView";

export default async function MyTicketsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user as any;
  if (user.isMasterAdmin || user.isSupportTechnician) redirect("/support");

  // Load user's leagues for the create-ticket form
  const roles = await prisma.userLeagueRole.findMany({
    where: { userId: user.id },
    include: { league: { select: { id: true, name: true } } },
    distinct: ["leagueId"],
  });
  const leagues = roles.map(r => ({ id: r.league.id, name: r.league.name }));

  return <MyTicketsView leagues={leagues} />;
}
