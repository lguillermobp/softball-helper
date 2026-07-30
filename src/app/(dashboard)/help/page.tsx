import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { HelpView } from "@/components/help/HelpView";

// Signed-in only — redirect to login when there is no session.
export default async function HelpPage() {
  const session = await auth();
  const user = session?.user ?? null;
  if (!user) redirect("/login");
  const isMasterAdmin = Boolean((user as { isMasterAdmin?: boolean } | null)?.isMasterAdmin);

  const roles = (await prisma.userLeagueRole.findMany({
    where: { userId: user.id! },
    select: { role: true },
    distinct: ["role"],
  })).map((r) => r.role);

  const faqs = await prisma.faq.findMany({
    where: { active: true, status: "PUBLISHED" },
    orderBy: [{ category: "asc" }, { order: "asc" }],
    select: { id: true, category: true, questionEn: true, questionEs: true, answerEn: true, answerEs: true },
  });

  return (
    <HelpView
      roles={roles}
      isMasterAdmin={isMasterAdmin}
      isAuthed={!!user}
      userName={user?.name ?? null}
      faqs={faqs}
    />
  );
}
