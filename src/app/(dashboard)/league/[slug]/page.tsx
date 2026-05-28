import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { LeagueDashboard } from "@/components/league/LeagueDashboard";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageSelector } from "@/components/ui/language-selector";

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

  const rawConditions = await prisma.condition.findMany({
    where: { leagueId: league.id },
    include: { createdBy: { select: { id: true, name: true, email: true } } },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  const conditions = rawConditions.map((c) => ({
    id:        c.id,
    title:     c.title,
    content:   c.content,
    fileUrl:   c.fileUrl,
    fileName:  c.fileName,
    fileType:  c.fileType,
    order:     c.order,
    createdAt: c.createdAt.toISOString(),
    createdBy: c.createdBy,
  }));

  return (
    <div className="min-h-screen" style={{ background: "var(--sh-bg-page)" }}>
      <header
        className="border-b sticky top-0 z-10"
        style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-header)" }}
      >
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-sm flex items-center gap-1 transition-colors hover:opacity-80"
              style={{ color: "var(--sh-primary)" }}
            >
              ← Dashboard
            </Link>
            <span style={{ color: "var(--sh-border2)" }}>|</span>
            <span className="font-bold" style={{ color: "var(--sh-text)" }}>
              {league.name}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-medium border rounded-full px-2.5 py-0.5"
              style={{ background: "var(--sh-bg-card2)", color: "var(--sh-primary)", borderColor: "var(--sh-border2)" }}
            >
              {role.replace(/_/g, " ")}
            </span>
            <span className="hidden sm:block text-sm" style={{ color: "var(--sh-secondary)" }}>
              {sessionUser.name}
            </span>
            <ThemeToggle />
            <LanguageSelector />
            <form action="/api/auth/signout" method="POST">
              <button
                type="submit"
                className="text-sm px-3 py-1.5 rounded-md border transition-colors"
                style={{ borderColor: "var(--sh-border2)", color: "var(--sh-secondary)", background: "transparent" }}
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8" style={{ color: "var(--sh-text)" }}>
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
          conditions={conditions}
        />
      </main>
    </div>
  );
}
