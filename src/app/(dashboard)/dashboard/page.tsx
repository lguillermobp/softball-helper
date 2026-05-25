import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userWithLeagues = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      leagueRoles: {
        include: {
          league: {
            include: { seasons: true, teams: true },
          },
        },
      },
    },
  });

  const leagueRoles = userWithLeagues?.leagueRoles ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
          <span className="text-xl font-bold text-green-700">Softball Helper</span>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">{session.user.name}</span>
            <form action="/api/auth/signout" method="POST">
              <Button variant="outline" size="sm" type="submit">Sign out</Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">My Leagues</h1>
          <Link href="/register">
            <Button size="sm">+ New league</Button>
          </Link>
        </div>

        {leagueRoles.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500 mb-4">You're not part of any leagues yet.</p>
              <Link href="/register">
                <Button>Create your first league</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {leagueRoles.map(({ league, role }: { league: any; role: string }) => (
              <Card key={league.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{league.name}</CardTitle>
                    <span className="text-xs font-medium bg-green-100 text-green-800 rounded-full px-2 py-0.5">
                      {role.replace("_", " ")}
                    </span>
                  </div>
                  {(league.city || league.state) && (
                    <p className="text-sm text-gray-500">
                      {[league.city, league.state].filter(Boolean).join(", ")}
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4 text-sm text-gray-600 mb-4">
                    <span>{league.seasons.length} season{league.seasons.length !== 1 ? "s" : ""}</span>
                    <span>{league.teams.length} team{league.teams.length !== 1 ? "s" : ""}</span>
                  </div>
                  <Link href={`/league/${league.slug}`}>
                    <Button variant="outline" size="sm" className="w-full">
                      Open league
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
