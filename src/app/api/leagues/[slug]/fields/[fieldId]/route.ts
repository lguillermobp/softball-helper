import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ slug: string; fieldId: string }> }

async function getLeagueAndCheckAdmin(slug: string, userId: string, isMasterAdmin: boolean) {
  const league = await prisma.league.findUnique({
    where: { slug },
    include: { userRoles: { where: { userId } } },
  });
  if (!league) return null;
  const isAdmin = isMasterAdmin || league.userRoles.some((r) => r.role === "LEAGUE_ADMIN");
  return isAdmin ? league : null;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, fieldId } = await params;
  const league = await getLeagueAndCheckAdmin(slug, session.user.id!, (session.user as any).isMasterAdmin);
  if (!league) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, types, slotStartTime, slotDurationMins, slotsMonday, slotsTuesday, slotsWednesday, slotsThursday, slotsFriday, slotsSaturday, slotsSunday } = await req.json();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const field = await prisma.field.findFirst({ where: { id: fieldId, leagueId: league.id } });
  if (!field) return NextResponse.json({ error: "Field not found" }, { status: 404 });

  const updated = await prisma.field.update({
    where: { id: fieldId },
    data: {
      name, types: types ?? [],
      slotStartTime: slotStartTime || null,
      slotDurationMins: slotDurationMins ?? 90,
      slotsMonday: slotsMonday ?? 0, slotsTuesday: slotsTuesday ?? 0,
      slotsWednesday: slotsWednesday ?? 0, slotsThursday: slotsThursday ?? 0,
      slotsFriday: slotsFriday ?? 0, slotsSaturday: slotsSaturday ?? 0, slotsSunday: slotsSunday ?? 0,
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, fieldId } = await params;
  const league = await getLeagueAndCheckAdmin(slug, session.user.id!, (session.user as any).isMasterAdmin);
  if (!league) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const field = await prisma.field.findFirst({ where: { id: fieldId, leagueId: league.id } });
  if (!field) return NextResponse.json({ error: "Field not found" }, { status: 404 });

  await prisma.field.delete({ where: { id: fieldId } });
  return NextResponse.json({ success: true });
}
