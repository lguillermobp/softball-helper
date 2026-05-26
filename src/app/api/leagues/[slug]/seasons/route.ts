import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ slug: string }> }

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

  const { name, startDate, endDate, status } = await req.json();
  if (!name || !startDate || !endDate)
    return NextResponse.json({ error: "name, startDate and endDate are required" }, { status: 400 });

  const season = await prisma.season.create({
    data: {
      leagueId: league.id,
      name,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      status: status ?? "UPCOMING",
    },
  });

  return NextResponse.json(season, { status: 201 });
}
