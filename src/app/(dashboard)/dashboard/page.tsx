import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DashboardView } from "@/components/dashboard/DashboardView";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const isMasterAdmin = (session.user as any).isMasterAdmin as boolean;

  if (isMasterAdmin) {
    try {
      const allLeagues = await prisma.league.findMany({
        include: {
          plan: { select: { name: true } },
          _count: { select: { seasons: true, teams: true, players: true } },
        },
        orderBy: { name: "asc" },
      });

      return (
        <DashboardView
          isMasterAdmin
          userName={session.user.name}
          allLeagues={allLeagues.map((l) => ({
            id: l.id, name: l.name, slug: l.slug,
            city: l.city, state: l.state, status: l.status,
            plan: { name: l.plan.name },
            _count: l._count,
          }))}
          leagueRoles={[]}
        />
      );
    } catch (err) {
      console.error("[dashboard:admin] DB error:", err);
      throw err;
    }
  }

  try {
    const userWithLeagues = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        leagueRoles: {
          include: {
            league: {
              include: { _count: { select: { seasons: true, teams: true } } },
            },
          },
        },
      },
    });

    const ROLE_PRIORITY = ["LEAGUE_ADMIN", "UMPIRE", "SCOREKEEPER", "TEAM_MANAGER", "TEAM_MANAGER_PLAYER", "TEAM_ASSISTANT", "PLAYER"];
    const leagueMap = new Map<string, { role: string; league: { id: string; name: string; slug: string; city: string | null; state: string | null; _count: { seasons: number; teams: number } } }>();
    for (const ur of (userWithLeagues?.leagueRoles ?? [])) {
      const entry = {
        role: ur.role,
        league: { id: ur.league.id, name: ur.league.name, slug: ur.league.slug, city: ur.league.city, state: ur.league.state, _count: ur.league._count },
      };
      const existing = leagueMap.get(ur.league.id);
      if (!existing || ROLE_PRIORITY.indexOf(ur.role) < ROLE_PRIORITY.indexOf(existing.role)) {
        leagueMap.set(ur.league.id, entry);
      }
    }

    return (
      <DashboardView
        isMasterAdmin={false}
        userName={session.user.name}
        allLeagues={[]}
        leagueRoles={Array.from(leagueMap.values())}
      />
    );
  } catch (err) {
    console.error("[dashboard:user] DB error:", err);
    throw err;
  }
}
