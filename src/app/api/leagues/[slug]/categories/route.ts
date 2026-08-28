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
  if (league.status === "SUSPENDED") return NextResponse.json({ error: "This league is currently suspended." }, { status: 423 });

  const { name, description, minAge, maxAge } = await req.json();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const min = minAge === "" || minAge == null ? null : Math.trunc(Number(minAge));
  const max = maxAge === "" || maxAge == null ? null : Math.trunc(Number(maxAge));
  if ((min != null && (!Number.isFinite(min) || min < 0)) || (max != null && (!Number.isFinite(max) || max < 0)))
    return NextResponse.json({ error: "Ages must be positive numbers" }, { status: 400 });
  if (min != null && max != null && min > max)
    return NextResponse.json({ error: "Minimum age can't be greater than maximum age" }, { status: 400 });

  const category = await prisma.category.create({
    data: { leagueId: league.id, name, description: description ?? null, minAge: min, maxAge: max },
  });

  return NextResponse.json(category, { status: 201 });
}
