import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AdminSubscriptionsView } from "@/components/admin/AdminSubscriptionsView";
import { ChangePasswordButton } from "@/components/ui/change-password-button";

export const dynamic = "force-dynamic";

export default async function AdminSubscriptionsPage() {
  const session = await auth();
  if (!(session?.user as any)?.isMasterAdmin) redirect("/dashboard");

  const [leagues, plans] = await Promise.all([
    prisma.league.findMany({
      orderBy: { name: "asc" },
      include: {
        plan: { select: { name: true } },
        subscriptions: {
          where: { status: "ACTIVE" },
          orderBy: { startDate: "desc" },
          take: 1,
          include: { plan: { select: { id: true, name: true, price: true, maxGames: true } } },
        },
      },
    }),
    prisma.plan.findMany({ orderBy: { price: "asc" } }),
  ]);

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
            <Link href="/admin/plans" className="text-sm px-3 py-1.5 rounded-md border transition-colors"
              style={{ borderColor: "var(--sh-border2)", color: "var(--sh-secondary)", background: "transparent" }}>
              Plans
            </Link>
            <Link href="/admin/coupons" className="text-sm px-3 py-1.5 rounded-md border transition-colors"
              style={{ borderColor: "var(--sh-border2)", color: "var(--sh-secondary)", background: "transparent" }}>
              Coupons
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
        <AdminSubscriptionsView
          leagues={leagues.map(l => ({
            id: l.id,
            name: l.name,
            slug: l.slug,
            status: l.status,
            plan: { name: l.plan.name },
            activeSub: l.subscriptions[0] ? {
              id: l.subscriptions[0].id,
              planId: l.subscriptions[0].planId,
              maxGames: l.subscriptions[0].maxGames,
              startDate: l.subscriptions[0].startDate.toISOString(),
              endDate: l.subscriptions[0].endDate.toISOString(),
              status: l.subscriptions[0].status,
              cancelledAt: l.subscriptions[0].cancelledAt?.toISOString() ?? null,
              note: l.subscriptions[0].note,
              stripeSubscriptionId: l.subscriptions[0].stripeSubscriptionId,
              plan: l.subscriptions[0].plan,
            } : null,
          }))}
          plans={plans.map(p => ({
            id: p.id,
            name: p.name,
            price: p.price,
            maxGames: p.maxGames,
          }))}
        />
      </main>
    </div>
  );
}
