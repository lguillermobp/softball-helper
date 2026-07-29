import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AdminFaqsView } from "@/components/admin/AdminFaqsView";
import { ChangePasswordButton } from "@/components/ui/change-password-button";

export const dynamic = "force-dynamic";

const navLink = {
  className: "text-sm px-3 py-1.5 rounded-md border transition-colors",
  style: { borderColor: "var(--sh-border2)", color: "var(--sh-secondary)", background: "transparent" } as React.CSSProperties,
};

export default async function AdminFaqsPage() {
  const session = await auth();
  if (!(session?.user as any)?.isMasterAdmin) redirect("/dashboard");

  const faqs = await prisma.faq.findMany({ orderBy: [{ category: "asc" }, { order: "asc" }] });

  return (
    <div className="min-h-screen" style={{ background: "var(--sh-bg-page)" }}>
      <header className="border-b sticky top-0 z-10" style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-header)" }}>
        <div className="mx-auto max-w-5xl px-4 py-3 flex flex-wrap items-center justify-between gap-y-2">
          <span className="text-lg font-bold tracking-tight" style={{ color: "var(--sh-primary)" }}>FAQs</span>
          <div className="flex flex-wrap items-center gap-2 justify-end">
            <ChangePasswordButton />
            <Link href="/admin/users" {...navLink}>Users</Link>
            <Link href="/admin/plans" {...navLink}>Plans</Link>
            <Link href="/admin/coupons" {...navLink}>Coupons</Link>
            <Link href="/help" {...navLink}>Help page</Link>
            <Link href="/dashboard" {...navLink}>Dashboard</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <AdminFaqsView initialFaqs={faqs.map((f) => ({
          id: f.id, category: f.category,
          questionEn: f.questionEn, questionEs: f.questionEs,
          answerEn: f.answerEn, answerEs: f.answerEs,
          order: f.order, active: f.active,
        }))} />
      </main>
    </div>
  );
}
