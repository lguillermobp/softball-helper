import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Next.js 16: route params are a Promise
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
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      seasons: { orderBy: { startDate: "desc" } },
      categories: true,
      teams: {
        include: { season: true, category: true },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!league) notFound();

  // session.user is guaranteed here (we redirected above if missing),
  // but TypeScript doesn't narrow through redirect(), so assert it.
  const sessionUser = session.user!;

  // Must be a master admin OR have a role in this league
  const isMasterAdmin = (sessionUser as any).isMasterAdmin;
  const userRole = league.userRoles.find((r) => r.userId === sessionUser.id);
  if (!isMasterAdmin && !userRole) redirect("/dashboard");

  const role = userRole?.role ?? "MASTER_ADMIN";
  const isAdmin = isMasterAdmin || role === "LEAGUE_ADMIN";

  function roleLabel(r: string) {
    return r.replace(/_/g, " ");
  }

  function seasonStatusColor(status: string) {
    if (status === "ACTIVE") return "bg-green-100 text-green-800";
    if (status === "COMPLETED") return "bg-gray-100 text-gray-600";
    return "bg-yellow-100 text-yellow-800";
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              ← Dashboard
            </Link>
            <span className="text-gray-300">|</span>
            <span className="text-xl font-bold text-green-700">
              {league.name}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium bg-green-100 text-green-800 rounded-full px-2.5 py-1">
              {roleLabel(role)}
            </span>
            <span className="text-sm text-gray-600">{sessionUser.name}</span>
            <form action="/api/auth/signout" method="POST">
              <Button variant="outline" size="sm" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 space-y-8">
        {/* ── League Info ── */}
        <div className="grid gap-4 sm:grid-cols-4">
          <Card className="sm:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">League Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-gray-700">
              {(league.city || league.state) && (
                <p>
                  📍{" "}
                  {[league.city, league.state].filter(Boolean).join(", ")}
                </p>
              )}
              <p>
                📋 Plan:{" "}
                <span className="font-medium">{league.plan.name}</span>
              </p>
              <p>
                🔖 Status:{" "}
                <span className="font-medium capitalize">
                  {league.status.toLowerCase()}
                </span>
              </p>
              <p className="text-gray-400 text-xs pt-1">
                Slug: {league.slug}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Seasons</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-700">
                {league.seasons.length}
              </p>
              <p className="text-xs text-gray-500">total seasons</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Teams</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-700">
                {league.teams.length}
              </p>
              <p className="text-xs text-gray-500">registered teams</p>
            </CardContent>
          </Card>
        </div>

        {/* ── Seasons ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Seasons</h2>
            {isAdmin && (
              <Button size="sm" disabled title="Coming soon">
                + Add season
              </Button>
            )}
          </div>
          {league.seasons.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500 text-sm">
                No seasons yet.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {league.seasons.map((season) => (
                <Card key={season.id}>
                  <CardContent className="pt-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{season.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(season.startDate).toLocaleDateString()} –{" "}
                        {new Date(season.endDate).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-medium rounded-full px-2.5 py-1 ${seasonStatusColor(
                        season.status
                      )}`}
                    >
                      {season.status}
                    </span>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* ── Categories ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Categories</h2>
            {isAdmin && (
              <Button size="sm" disabled title="Coming soon">
                + Add category
              </Button>
            )}
          </div>
          {league.categories.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500 text-sm">
                No categories yet.
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-wrap gap-2">
              {league.categories.map((cat) => (
                <span
                  key={cat.id}
                  className="bg-white border border-gray-200 rounded-full px-4 py-1.5 text-sm font-medium text-gray-700"
                >
                  {cat.name}
                  {cat.description && (
                    <span className="text-gray-400 font-normal ml-1">
                      — {cat.description}
                    </span>
                  )}
                </span>
              ))}
            </div>
          )}
        </section>

        {/* ── Teams ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Teams</h2>
            {isAdmin && (
              <Button size="sm" disabled title="Coming soon">
                + Add team
              </Button>
            )}
          </div>
          {league.teams.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500 text-sm">
                No teams yet.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {league.teams.map((team) => (
                <Card key={team.id}>
                  <CardContent className="pt-4">
                    <p className="font-medium text-gray-900">{team.name}</p>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {team.season && (
                        <span className="text-xs text-gray-500">
                          {team.season.name}
                        </span>
                      )}
                      {team.category && (
                        <span className="text-xs bg-blue-50 text-blue-700 rounded px-1.5 py-0.5">
                          {team.category.name}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* ── Members (admin only) ── */}
        {isAdmin && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900">Members</h2>
              <Button size="sm" disabled title="Coming soon">
                + Invite member
              </Button>
            </div>
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left">
                      <th className="px-4 py-3 font-medium text-gray-600">Name</th>
                      <th className="px-4 py-3 font-medium text-gray-600">Email</th>
                      <th className="px-4 py-3 font-medium text-gray-600">Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {league.userRoles.map((ur) => (
                      <tr
                        key={ur.id}
                        className="border-b border-gray-50 last:border-0 hover:bg-gray-50"
                      >
                        <td className="px-4 py-3 text-gray-900">
                          {ur.user.name ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {ur.user.email}
                        </td>
                        <td className="px-4 py-3">
                          <span className="bg-green-50 text-green-700 text-xs font-medium rounded-full px-2 py-0.5">
                            {roleLabel(ur.role)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </section>
        )}
      </main>
    </div>
  );
}
