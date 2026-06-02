import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPlayerInviteEmail, sendRoleNotificationEmail } from "@/lib/email";

interface Params { params: Promise<{ slug: string }> }

interface PlayerInput { name: string; email: string; jerseyNumber?: string | null }

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const league = await prisma.league.findUnique({
    where: { slug },
    include: { userRoles: { where: { userId: session.user.id } } },
  });
  if (!league) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isMasterAdmin = (session.user as any).isMasterAdmin;
  const isAdmin = isMasterAdmin || league.userRoles.some((r) =>
    r.role === "LEAGUE_ADMIN" || r.role === "TEAM_MANAGER" || r.role === "TEAM_MANAGER_PLAYER"
  );
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { teamId, players } = await req.json() as { teamId: string; players: PlayerInput[] };
  if (!teamId || !Array.isArray(players) || players.length === 0)
    return NextResponse.json({ error: "teamId and players array are required" }, { status: 400 });

  const team = await prisma.team.findFirst({ where: { id: teamId, leagueId: league.id } });
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const results: { name: string; email: string; status: "added" | "linked" | "error"; message?: string }[] = [];

  for (const p of players) {
    if (!p.name || !p.email || !emailRegex.test(p.email)) {
      results.push({ name: p.name ?? "", email: p.email ?? "", status: "error", message: "Invalid data" });
      continue;
    }

    try {
      let user = await prisma.user.findUnique({ where: { email: p.email } });
      const isNew = !user;
      const wasVerified = !isNew && !!user!.emailVerified;

      if (!user) {
        user = await prisma.user.create({ data: { name: p.name, email: p.email } });
      }

      await prisma.player.upsert({
        where: { email_teamId: { email: p.email, teamId } },
        update: { name: p.name, jerseyNumber: p.jerseyNumber || null, userId: user.id },
        create: {
          name: p.name,
          email: p.email,
          jerseyNumber: p.jerseyNumber || null,
          teamId,
          leagueId: league.id,
          userId: user.id,
        },
      });

      if (isNew) {
        sendPlayerInviteEmail(p.email, p.name, team.name, league.name).catch(
          (e) => console.error("[BULK PLAYERS] invite failed:", e)
        );
      } else if (wasVerified) {
        sendRoleNotificationEmail(p.email, user!.name, league.name, `player in ${team.name}`).catch(
          (e) => console.error("[BULK PLAYERS] notify failed:", e)
        );
      }

      results.push({ name: p.name, email: p.email, status: isNew ? "added" : "linked" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unexpected error";
      results.push({ name: p.name, email: p.email, status: "error", message: msg });
    }
  }

  return NextResponse.json({ results });
}
