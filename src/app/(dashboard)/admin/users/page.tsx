import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AdminUsersView } from "@/components/admin/AdminUsersView";
import { ChangePasswordButton } from "@/components/ui/change-password-button";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await auth();
  if (!(session?.user as any)?.isMasterAdmin) redirect("/dashboard");

  const dbUrl =
    process.env.DATABASE_URL ||
    process.env.DATABASE_PRIVATE_URL ||
    process.env.DATABASE_PUBLIC_URL ||
    process.env.POSTGRES_URL ||
    "";

  let serialized: any[] = [];
  let errorMsg: string | null = null;

  try {
    const pool = new Pool({ connectionString: dbUrl, ssl: false });

    const [usersRes, countRes, rolesRes] = await Promise.all([
      pool.query(`
        SELECT id, name, email, phone,
               "emailVerified", "isMasterAdmin",
               COALESCE("isActive", true) AS "isActive",
               "createdAt"
        FROM users
        ORDER BY "isMasterAdmin" DESC, "createdAt" DESC
      `),
      pool.query(`SELECT COUNT(*) AS total FROM users`),
      pool.query(`SELECT "userId", COUNT(*) AS cnt FROM user_league_roles GROUP BY "userId"`),
    ]);

    await pool.end();

    const countMap = new Map<string, number>(
      rolesRes.rows.map((r: any) => [r.userId, Number(r.cnt)])
    );

    serialized = usersRes.rows.map((u: any) => ({
      id:            u.id,
      name:          u.name,
      email:         u.email,
      phone:         u.phone,
      emailVerified: u.emailVerified ? new Date(u.emailVerified).toISOString() : null,
      isMasterAdmin: u.isMasterAdmin,
      isActive:      u.isActive ?? true,
      createdAt:     new Date(u.createdAt).toISOString(),
      _count:        { leagueRoles: countMap.get(u.id) ?? 0 },
    }));
  } catch (err: any) {
    console.error("[ADMIN/USERS]", err);
    errorMsg = `${err?.message ?? "Unknown error"} | URL used: ${dbUrl.replace(/:\/\/[^@]+@/, "://*****@")}`;
  }

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
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: "var(--sh-bg-card2)", color: "var(--sh-primary)", border: "1px solid var(--sh-border2)" }}>
                {session?.user?.name?.charAt(0).toUpperCase() ?? "?"}
              </div>
              <span className="text-sm" style={{ color: "var(--sh-secondary)" }}>{session?.user?.name}</span>
            </div>
            <ChangePasswordButton />
            <Link href="/dashboard"
              className="text-sm px-3 py-1.5 rounded-md border transition-colors"
              style={{ borderColor: "var(--sh-border2)", color: "var(--sh-secondary)", background: "transparent" }}>
              ← Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: "var(--sh-text)" }}>System Users</h1>
          <p className="text-sm mt-1" style={{ color: "var(--sh-purple)" }}>
            {errorMsg
              ? "Could not load users"
              : `${serialized.length} registered user${serialized.length !== 1 ? "s" : ""}`}
          </p>
        </div>

        {errorMsg ? (
          <div className="rounded-2xl border p-6" style={{ borderColor: "#7f1d1d", background: "#1a0a0a" }}>
            <p className="text-sm font-semibold mb-2" style={{ color: "#f87171" }}>Error</p>
            <p className="text-xs font-mono break-all" style={{ color: "#fca5a5" }}>{errorMsg}</p>
          </div>
        ) : (
          <AdminUsersView initialUsers={serialized} />
        )}
      </main>
    </div>
  );
}
