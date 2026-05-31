import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPlayerInviteEmail, sendRoleNotificationEmail } from "@/lib/email";
import { logAudit } from "@/lib/audit";

interface Params { params: Promise<{ slug: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const { searchParams } = new URL(req.url);
  const teamId = searchParams.get("teamId");

  const league = await prisma.league.findUnique({ where: { slug } });
  if (!league) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const players = await prisma.player.findMany({
    where: { leagueId: league.id, ...(teamId ? { teamId } : {}) },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(players);
}

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
    r.role === "LEAGUE_ADMIN" || r.role === "TEAM_MANAGER"
  );
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { name, jerseyNumber, teamId } = body;
  const email: string | null = (body.email as string | undefined)?.trim() || null;
  const nationality: string | null = (body.nationality as string | undefined) || null;

  if (!name || !teamId)
    return NextResponse.json({ error: "name and teamId are required" }, { status: 400 });

  if (email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email))
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  const team = await prisma.team.findFirst({ where: { id: teamId, leagueId: league.id } });
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  if (!email) {
    const player = await prisma.player.create({
      data: { name, email: null, jerseyNumber: jerseyNumber || null, nationality, teamId, leagueId: league.id },
    });
    await logAudit({ actor: session.user as any, action: "player.create", entityType: "Player", entityId: player.id, leagueId: league.id, leagueName: league.name, metadata: { name, teamId } });
    return NextResponse.json(player, { status: 201 });
  }

  // --- email provided ---
  let user = await prisma.user.findUnique({ where: { email } });
  const isNew = !user;
  const wasVerified = !isNew && !!user!.emailVerified;

  if (!user) {
    user = await prisma.user.create({ data: { name, email } });
  }

  const [player] = await prisma.$transaction([
    prisma.player.upsert({
      where: { email_teamId: { email, teamId } },
      update: { name, jerseyNumber: jerseyNumber || null, nationality, userId: user.id },
      create: { name, email, jerseyNumber: jerseyNumber || null, nationality, teamId, leagueId: league.id, userId: user.id },
    }),
    // Grant PLAYER league role so the league appears in their dashboard
    prisma.userLeagueRole.upsert({
      where: { userId_leagueId_role: { userId: user.id, leagueId: league.id, role: "PLAYER" } },
      update: {},
      create: { userId: user.id, leagueId: league.id, role: "PLAYER" },
    }),
  ]);

  if (isNew) {
    sendPlayerInviteEmail(email, name, team.name, league.name).catch(
      (e) => console.error("[PLAYERS] invite failed:", e)
    );
  } else if (wasVerified) {
    sendRoleNotificationEmail(email, user.name, league.name, `player in ${team.name}`).catch(
      (e) => console.error("[PLAYERS] notification failed:", e)
    );
  }

  await logAudit({ actor: session.user as any, action: "player.create", entityType: "Player", entityId: player.id, leagueId: league.id, leagueName: league.name, metadata: { name, email, teamId } });
  return NextResponse.json(player, { status: 201 });
}
