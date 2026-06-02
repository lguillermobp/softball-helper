import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AdminPlansView } from "@/components/admin/AdminPlansView";
import { ChangePasswordButton } from "@/components/ui/change-password-button";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminPlansPage() {
  const session = await auth();
  if (!(session?.user as any)?.isMasterAdmin) redirect("/dashboard");

  const plans = await prisma.plan.findMany({
    orderBy: { price: "asc" },
    include: { _count: { select: { leagues: true } } },
  });

  return (
    <div className="min-h-screen" style={{ background: "var(--sh-bg-page)" }}>
      <header className="border-b sticky top-0 z-10" style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-header)" }}>
        <div className="mx-auto max-w-5xl px-4 py-3 flex flex-wrap items-center justify-between gap-y-2">
          <div className="flex items-center gap-3">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="13" fill="var(--sh-bg-card2)" stroke="var(--sh-primary)" strokeWidth="1.5"/>
              <path d="M8 10 C10 8,10 6,12 5" stroke="var(--sh-primary)" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
              <path d="M8 14 C10 12,10 10,12 9" stroke="var(--sh-primary)" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
              <path d="M8 18 C10 16,10 14,12 13" stroke="var(--sh-primary)" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
              <path d="M20 10 C18 8,18 6,16 5" stroke="var(--sh-primary)" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
              <path d="M20 14 C18 12,18 10,16 9" stroke="var(--sh-primary)" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
              <path d="M20 18 C18 16,18 14,16 13" stroke="var(--sh-primary)" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
            </svg>
            <span className="hidden sm:inline text-lg font-bold tracking-tight" style={{ color: "var(--sh-primary)" }}>Softball Helper</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 justify-end">
            <ChangePasswordButton />
            <Link href="/admin/users" className="text-sm px-3 py-1.5 rounded-md border transition-colors"
              style={{ borderColor: "var(--sh-border2)", color: "var(--sh-secondary)", background: "transparent" }}>
              Users
            </Link>
            <Link href="/admin/audit" className="text-sm px-3 py-1.5 rounded-md border transition-colors"
              style={{ borderColor: "var(--sh-border2)", color: "var(--sh-secondary)", background: "transparent" }}>
              Audit
            </Link>
            <Link href="/dashboard" className="text-sm px-3 py-1.5 rounded-md border transition-colors"
              style={{ borderColor: "var(--sh-border2)", color: "var(--sh-secondary)", background: "transparent" }}>
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <AdminPlansView initialPlans={plans.map((p) => ({
          id: p.id,
          name: p.name,
          price: p.price,
          maxTeams: p.maxTeams,
          maxSeasons: p.maxSeasons,
          maxPlayers: p.maxPlayers,
          isActive: p.isActive,
          stripePriceId: p.stripePriceId,
          leagueCount: p._count.leagues,
        }))} />
      </main>
    </div>
  );
}
