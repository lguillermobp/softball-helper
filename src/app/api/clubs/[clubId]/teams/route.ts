import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ clubId: string }> }

async function loadOwnedClub(clubId: string, userId: string, isMasterAdmin: boolean) {
  const club = await prisma.club.findUnique({ where: { id: clubId }, select: { id: true, ownerId: true } });
  if (!club) return null;
  if (!isMasterAdmin && club.ownerId !== userId) return null;
  return club;
}

// Attach a team to the club.
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { clubId } = await params;
  const club = await loadOwnedClub(clubId, me.id, !!me.isMasterAdmin);
  if (!club) return NextResponse.json({ error: "Club not found" }, { status: 404 });

  const teamId = ((await req.json().catch(() => ({}))).teamId ?? "").toString();
  if (!teamId) return NextResponse.json({ error: "teamId is required" }, { status: 400 });

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, clubId: true, managerId: true, assistantId: true },
  });
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const managesTeam = me.isMasterAdmin || team.managerId === me.id || team.assistantId === me.id;
  if (!managesTeam) return NextResponse.json({ error: "You can only attach teams you manage." }, { status: 403 });
  if (team.clubId === clubId) return NextResponse.json({ success: true });
  if (team.clubId) return NextResponse.json({ error: "That team is already in another club." }, { status: 409 });

  await prisma.team.update({ where: { id: teamId }, data: { clubId } });
  return NextResponse.json({ success: true });
}

// Detach a team from the club.
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { clubId } = await params;
  const club = await loadOwnedClub(clubId, me.id, !!me.isMasterAdmin);
  if (!club) return NextResponse.json({ error: "Club not found" }, { status: 404 });

  const teamId = req.nextUrl.searchParams.get("teamId");
  if (!teamId) return NextResponse.json({ error: "teamId is required" }, { status: 400 });

  await prisma.team.updateMany({ where: { id: teamId, clubId }, data: { clubId: null } });
  return NextResponse.json({ success: true });
}
