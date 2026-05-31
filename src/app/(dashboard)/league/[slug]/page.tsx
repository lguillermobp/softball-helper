import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { LeagueDashboard } from "@/components/league/LeagueDashboard";
import { PlayerDashboard } from "@/components/league/PlayerDashboard";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageSelector } from "@/components/ui/language-selector";
import { SignOutButton } from "@/components/ui/sign-out-button";
import { ChangePasswordButton } from "@/components/ui/change-password-button";

interface PageProps {
  params: Promise<{ slug: string }>;
}

const ROLE_PRIORITY = ["LEAGUE_ADMIN", "UMPIRE", "SCOREKEEPER", "TEAM_MANAGER", "TEAM_ASSISTANT", "PLAYER"];

export default async function LeaguePage({ params }: PageProps) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const sessionUser = session.user!;
  const isMasterAdmin = (sessionUser as any).isMasterAdmin;

  // ── Common league query (used for all roles) ──────────────────────────────
  const league = await prisma.league.findUnique({
    where: { slug },
    include: {
      plan: true,
      userRoles: {
        include: { user: { select: { id: true, name: true, email: true, phone: true, emailVerified: true } } },
      },
      seasons: { orderBy: { startDate: "desc" } },
    },
  });
  if (!league) notFound();

  // Pick the highest-priority role for the current user
  const myRoles = league.userRoles.filter((r) => r.userId === sessionUser.id);
  const userRole = myRoles.sort((a, b) => ROLE_PRIORITY.indexOf(a.role) - ROLE_PRIORITY.indexOf(b.role))[0];
  if (!isMasterAdmin && !userRole) redirect("/dashboard");

  const role = userRole?.role ?? "MASTER_ADMIN";

  const seasons = league.seasons.map((s) => ({
    id: s.id,
    name: s.name,
    startDate: s.startDate.toISOString(),
    endDate: s.endDate.toISOString(),
    status: s.status,
  }));

  // ── Header (shared across all roles) ──────────────────────────────────────
  const Header = (
    <header className="border-b sticky top-0 z-10"
      style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-header)" }}>
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-sm flex items-center gap-1 transition-colors hover:opacity-80"
            style={{ color: "var(--sh-primary)" }}>
            ← Dashboard
          </Link>
          <span style={{ color: "var(--sh-border2)" }}>|</span>
          <span className="font-bold" style={{ color: "var(--sh-text)" }}>{league.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: "var(--sh-bg-card2)", color: "var(--sh-primary)", border: "1px solid var(--sh-border2)" }}>
              {sessionUser.name?.charAt(0).toUpperCase() ?? "?"}
            </div>
            <span className="text-sm" style={{ color: "var(--sh-secondary)" }}>{sessionUser.name}</span>
          </div>
          <span className="text-xs font-medium border rounded-full px-2.5 py-0.5"
            style={{ background: "var(--sh-bg-card2)", color: "var(--sh-primary)", borderColor: "var(--sh-border2)" }}>
            {role.replace(/_/g, " ")}
          </span>
          <ThemeToggle />
          <LanguageSelector />
          <ChangePasswordButton />
          <SignOutButton />
        </div>
      </div>
    </header>
  );

  // ── PLAYER view ────────────────────────────────────────────────────────────
  if (role === "PLAYER") {
    const myPlayers = await prisma.player.findMany({
      where: { leagueId: league.id, userId: sessionUser.id },
      include: {
        team: {
          include: {
            manager:   { select: { name: true, email: true, phone: true } },
            assistant: { select: { name: true, email: true, phone: true } },
            players:   { orderBy: { name: "asc" }, select: { id: true, name: true, jerseyNumber: true } },
          },
        },
      },
    });

    const myTeams = myPlayers.map(({ team }) => ({
      id:         team.id,
      name:       team.name,
      manager:    team.manager,
      assistant:  team.assistant,
      teammates:  team.players,
    }));

    return (
      <div className="min-h-screen" style={{ background: "var(--sh-bg-page)" }}>
        {Header}
        <main className="mx-auto max-w-6xl px-4 py-8" style={{ color: "var(--sh-text)" }}>
          <PlayerDashboard
            slug={slug}
            league={{ name: league.name, city: league.city, state: league.state }}
            myTeams={myTeams}
            seasons={seasons}
          />
        </main>
      </div>
    );
  }

  // ── Admin / Manager view ───────────────────────────────────────────────────
  const fullLeague = await prisma.league.findUnique({
    where: { slug },
    include: {
      categories: true,
      teams: {
        include: {
          season:    { select: { id: true, name: true } },
          category:  { select: { id: true, name: true } },
          manager:   { select: { id: true, name: true, email: true, phone: true } },
          assistant: { select: { id: true, name: true, email: true, phone: true } },
          players: {
            orderBy: { name: "asc" },
            include: { user: { select: { password: true, emailVerified: true } } },
          },
        },
        orderBy: { name: "asc" },
      },
      fields: { orderBy: { name: "asc" } },
    },
  });
  if (!fullLeague) notFound();

  const isAdmin = isMasterAdmin || role === "LEAGUE_ADMIN";

  const categories = fullLeague.categories.map((c) => ({ id: c.id, name: c.name, description: c.description }));

  const teams = fullLeague.teams.map((t) => ({
    id: t.id, name: t.name, status: t.status, isActive: t.isActive,
    seasonId: t.seasonId, categoryId: t.categoryId,
    season: t.season, category: t.category,
    manager:   t.manager   ? { id: t.manager.id,   name: t.manager.name,   email: t.manager.email,   phone: t.manager.phone }   : null,
    assistant: t.assistant ? { id: t.assistant.id, name: t.assistant.name, email: t.assistant.email, phone: t.assistant.phone } : null,
    players: t.players.map((p) => ({
      id: p.id, name: p.name, email: p.email, jerseyNumber: p.jerseyNumber, photoUrl: p.photoUrl ?? null, userId: p.userId,
      invitePending: !!(p.email && (!p.user?.password || !p.user?.emailVerified)),
    })),
  }));

  const members = league.userRoles.map((ur) => ({
    id: ur.id, role: ur.role,
    user: {
      id: ur.user.id, name: ur.user.name, email: ur.user.email,
      phone: ur.user.phone, emailVerified: ur.user.emailVerified?.toISOString() ?? null,
    },
  }));

  const fields = fullLeague.fields.map((f) => ({ id: f.id, name: f.name, types: f.types as string[] }));

  const rawConditions = await prisma.condition.findMany({
    where: { leagueId: league.id },
    include: { createdBy: { select: { id: true, name: true, email: true } } },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  const conditions = rawConditions.map((c) => ({
    id: c.id, title: c.title, content: c.content,
    fileUrl: c.fileUrl, fileName: c.fileName, fileType: c.fileType,
    order: c.order, createdAt: c.createdAt.toISOString(), createdBy: c.createdBy,
  }));

  return (
    <div className="min-h-screen" style={{ background: "var(--sh-bg-page)" }}>
      {Header}
      <main className="mx-auto max-w-6xl px-4 py-8" style={{ color: "var(--sh-text)" }}>
        <LeagueDashboard
          slug={slug}
          isAdmin={isAdmin}
          currentUserId={sessionUser.id!}
          league={{ id: league.id, name: league.name, city: league.city, state: league.state, status: league.status, plan: { name: league.plan.name } }}
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
