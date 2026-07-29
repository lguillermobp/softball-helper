import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { HelpView } from "@/components/help/HelpView";

export default async function HelpPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const isMasterAdmin = Boolean((session.user as { isMasterAdmin?: boolean }).isMasterAdmin);
  const roles = await prisma.userLeagueRole.findMany({
    where: { userId: session.user.id! },
    select: { role: true },
    distinct: ["role"],
  });

  return (
    <HelpView
      roles={roles.map((r) => r.role)}
      isMasterAdmin={isMasterAdmin}
      userName={session.user.name ?? null}
    />
  );
}
