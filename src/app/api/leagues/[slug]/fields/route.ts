import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ slug: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const league = await prisma.league.findUnique({ where: { slug } });
  if (!league) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const fields = await prisma.field.findMany({
    where: { leagueId: league.id },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(fields);
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
  const isAdmin = isMasterAdmin || league.userRoles.some((r) => r.role === "LEAGUE_ADMIN");
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, types, slotStartTime, slotDurationMins, slotsMonday, slotsTuesday, slotsWednesday, slotsThursday, slotsFriday, slotsSaturday, slotsSunday } = await req.json();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const field = await prisma.field.create({
    data: {
      leagueId: league.id, name, types: types ?? [],
      slotStartTime: slotStartTime || null,
      slotDurationMins: slotDurationMins ?? 90,
      slotsMonday: slotsMonday ?? 0, slotsTuesday: slotsTuesday ?? 0,
      slotsWednesday: slotsWednesday ?? 0, slotsThursday: slotsThursday ?? 0,
      slotsFriday: slotsFriday ?? 0, slotsSaturday: slotsSaturday ?? 0, slotsSunday: slotsSunday ?? 0,
    },
  });
  return NextResponse.json(field, { status: 201 });
}
