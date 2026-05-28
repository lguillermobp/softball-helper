import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AdminUsersView } from "@/components/admin/AdminUsersView";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await auth();
  if (!(session?.user as any)?.isMasterAdmin) redirect("/dashboard");

  let users: any[] = [];
  let errorMsg: string | null = null;

  try {
    users = await prisma.user.findMany({
      select: {
        id: true, name: true, email: true, phone: true,
        emailVerified: true, isMasterAdmin: true, isActive: true, createdAt: true,
        _count: { select: { leagueRoles: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  } catch (err: any) {
    console.error("[ADMIN/USERS] query failed:", err);
    errorMsg = err?.message ?? "Database error";
  }

  const serialized = users.map((u) => ({
    ...u,
    emailVerified: u.emailVerified?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
  }));

  return (
    <div className="min-h-screen" style={{ background: "var(--sh-bg-page)" }}>
      <header className="border-b sticky top-0 z-10" style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-header)" }}>
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="13" fill="var(--sh-bg-card2)" stroke="var(--sh-primary)" strokeWidth="1.5"/>
              <path d="M8 10 C10 8, 10 6, 12 5" stroke="var(--sh-primary)" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
              <path d="M8 14 C10 12, 10 10, 12 9" stroke="var(--sh-primary)" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
              <path d="M8 18 C10 16, 10 14, 12 13" stroke="var(--sh-primary)" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
              <path d="M20 10 C18 8, 18 6, 16 5" stroke="var(--sh-primary)" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
              <path d="M20 14 C18 12, 18 10, 16 9" stroke="var(--sh-primary)" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
              <path d="M20 18 C18 16, 18 14, 16 13" stroke="var(--sh-primary)" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
            </svg>
            <span className="text-lg font-bold tracking-tight" style={{ color: "var(--sh-primary)" }}>Softball Helper</span>
            <span className="text-xs font-bold rounded-full px-2.5 py-0.5 border"
              style={{ background: "var(--sh-purple-bg)", color: "var(--sh-purple)", borderColor: "var(--sh-purple-border)" }}>
              ★ Master Admin
            </span>
          </div>
          <Link href="/dashboard"
            className="text-sm px-3 py-1.5 rounded-md border transition-colors"
            style={{ borderColor: "var(--sh-border2)", color: "var(--sh-secondary)", background: "transparent" }}>
            ← Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: "var(--sh-text)" }}>System Users</h1>
          <p className="text-sm mt-1" style={{ color: "var(--sh-purple)" }}>
            {errorMsg ? "Could not load users" : `${serialized.length} registered user${serialized.length !== 1 ? "s" : ""} — edit details, reset passwords, and deactivate accounts.`}
          </p>
        </div>

        {errorMsg ? (
          <div className="rounded-2xl border p-6" style={{ borderColor: "var(--sh-danger-border)", background: "var(--sh-bg-card)" }}>
            <p className="text-sm font-semibold mb-1" style={{ color: "#f87171" }}>Database error</p>
            <p className="text-xs font-mono" style={{ color: "var(--sh-muted)" }}>{errorMsg}</p>
            <p className="text-xs mt-3" style={{ color: "var(--sh-secondary)" }}>
              This usually means the database migration has not been applied on production.
              Run <code className="px-1 rounded" style={{ background: "var(--sh-bg-card2)" }}>railway run npx prisma migrate deploy</code> from your terminal.
            </p>
          </div>
        ) : (
          <AdminUsersView initialUsers={serialized} />
        )}
      </main>
    </div>
  );
}
