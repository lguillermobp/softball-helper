import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { LeagueDashboard } from "@/components/league/LeagueDashboard";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function LeaguePage({ params }: PageProps) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const league = await prisma.league.findUnique({
    where: { slug },
    include: {
      plan: true,
      userRoles: {
        include: { user: { select: { id: true, name: true, email: true, phone: true, emailVerified: true } } },
      },
      seasons: { orderBy: { startDate: "desc" } },
      categories: true,
      teams: {
        include: {
          season: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
          manager: { select: { id: true, name: true, email: true, phone: true } },
          assistant: { select: { id: true, name: true, email: true, phone: true } },
          players: { orderBy: { name: "asc" } },
        },
        orderBy: { name: "asc" },
      },
      fields: { orderBy: { name: "asc" } },
    },
  });

  if (!league) notFound();

  const sessionUser = session.user!;
  const isMasterAdmin = (sessionUser as any).isMasterAdmin;
  const userRole = league.userRoles.find((r) => r.userId === sessionUser.id);
  if (!isMasterAdmin && !userRole) redirect("/dashboard");

  const role = userRole?.role ?? "MASTER_ADMIN";
  const isAdmin = isMasterAdmin || role === "LEAGUE_ADMIN";

  // Serialize for client component
  const seasons = league.seasons.map((s) => ({
    id: s.id,
    name: s.name,
    startDate: s.startDate.toISOString(),
    endDate: s.endDate.toISOString(),
    status: s.status,
  }));

  const categories = league.categories.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
  }));

  const teams = league.teams.map((t) => ({
    id: t.id,
    name: t.name,
    status: t.status,
    isActive: t.isActive,
    seasonId: t.seasonId,
    categoryId: t.categoryId,
    season: t.season,
    category: t.category,
    manager: t.manager
      ? { id: t.manager.id, name: t.manager.name, email: t.manager.email, phone: t.manager.phone }
      : null,
    assistant: t.assistant
      ? { id: t.assistant.id, name: t.assistant.name, email: t.assistant.email, phone: t.assistant.phone }
      : null,
    players: t.players.map((p) => ({
      id: p.id,
      name: p.name,
      jerseyNumber: p.jerseyNumber,
      photoUrl: p.photoUrl ?? null,
      userId: p.userId,
    })),
  }));

  const members = league.userRoles.map((ur) => ({
    id: ur.id,
    role: ur.role,
    user: {
      id: ur.user.id,
      name: ur.user.name,
      email: ur.user.email,
      phone: ur.user.phone,
      emailVerified: ur.user.emailVerified?.toISOString() ?? null,
    },
  }));

  const fields = league.fields.map((f) => ({
    id: f.id,
    name: f.name,
    types: f.types as string[],
  }));

  return (
    <div className="min-h-screen" style={{ background: "#0a1a0a" }}>
      <header
        className="border-b sticky top-0 z-10"
        style={{ borderColor: "#1e3a1e", background: "#0f2310" }}
      >
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-sm flex items-center gap-1 transition-colors hover:opacity-80"
              style={{ color: "#4ade80" }}
            >
              ← Dashboard
            </Link>
            <span style={{ color: "#2d5a2d" }}>|</span>
            <span className="font-bold" style={{ color: "#f0fdf4" }}>
              {league.name}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span
              className="text-xs font-medium border rounded-full px-2.5 py-0.5"
              style={{ background: "#1a3d1a", color: "#4ade80", borderColor: "#2d5a2d" }}
            >
              {role.replace(/_/g, " ")}
            </span>
            <span className="hidden sm:block text-sm" style={{ color: "#86efac" }}>
              {sessionUser.name}
            </span>
            <form action="/api/auth/signout" method="POST">
              <button
                type="submit"
                className="text-sm px-3 py-1.5 rounded-md border transition-colors"
                style={{ borderColor: "#2d5a2d", color: "#86efac", background: "transparent" }}
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <LeagueDashboard
          slug={slug}
          isAdmin={isAdmin}
          currentUserId={sessionUser.id!}
          league={{
            id: league.id,
            name: league.name,
            city: league.city,
            state: league.state,
            status: league.status,
            plan: { name: league.plan.name },
          }}
          seasons={seasons}
          categories={categories}
          teams={teams}
          members={members}
          fields={fields}
        />
      </main>
    </div>
  );
}
