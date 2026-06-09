import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPlayerAcceptInviteEmail } from "@/lib/email";
import { logAudit, getRequestMeta } from "@/lib/audit";

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
    where: { leagueId: league.id, isActive: true, ...(teamId ? { teamId } : {}) },
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
    r.role === "LEAGUE_ADMIN" || r.role === "TEAM_MANAGER" || r.role === "TEAM_MANAGER_PLAYER"
  );
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { name, jerseyNumber, teamId } = body;
  const email: string | null = (body.email as string | undefined)?.trim() || null;
  const nationality: string | null = (body.nationality as string | undefined) || null;
  const dob: Date | null = body.dob ? new Date(body.dob) : null;

  if (!name || !teamId)
    return NextResponse.json({ error: "name and teamId are required" }, { status: 400 });

  if (email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email))
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  const team = await prisma.team.findFirst({
    where: { id: teamId, leagueId: league.id },
    include: { season: { select: { requireDob: true } } },
  });
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  if (team.season?.requireDob && !dob)
    return NextResponse.json({ error: "Date of birth is required for this season" }, { status: 400 });

  if (email) {
    const existing = await prisma.player.findFirst({ where: { email, leagueId: league.id } });
    if (existing)
      return NextResponse.json({ error: "This email is already registered as a player in this league" }, { status: 409 });
  }

  // Create player without linking a user account — ownership confirmed via accept-invite email
  const player = await prisma.player.create({
    data: { name, email, jerseyNumber: jerseyNumber || null, nationality, dob, teamId, leagueId: league.id },
  });

  if (email) {
    sendPlayerAcceptInviteEmail(email, name, team.name, league.name, player.id).catch(
      (e) => console.error("[PLAYERS] accept-invite failed:", e)
    );
  }

  await logAudit({
    actor: session.user as any, action: "player.create",
    entityType: "Player", entityId: player.id,
    leagueId: league.id, leagueName: league.name,
    metadata: { name, email, teamId },
    ...getRequestMeta(req),
  });
  return NextResponse.json(player, { status: 201 });
}
