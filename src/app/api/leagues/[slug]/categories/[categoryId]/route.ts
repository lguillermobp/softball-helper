import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ slug: string; categoryId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, categoryId } = await params;
  const league = await prisma.league.findUnique({
    where: { slug },
    include: { userRoles: { where: { userId: session.user.id } } },
  });
  if (!league) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isMasterAdmin = (session.user as any).isMasterAdmin;
  const isAdmin = isMasterAdmin || league.userRoles.some((r) => r.role === "LEAGUE_ADMIN");
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (league.status === "SUSPENDED") return NextResponse.json({ error: "This league is currently suspended." }, { status: 423 });

  const category = await prisma.category.findFirst({
    where: { id: categoryId, leagueId: league.id },
    select: { id: true, minAge: true, maxAge: true },
  });
  if (!category) return NextResponse.json({ error: "Category not found" }, { status: 404 });

  const b = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof b.name === "string" && b.name.trim()) data.name = b.name.trim();
  if (b.description !== undefined) data.description = (b.description ?? "").toString().trim() || null;

  let effMin = category.minAge, effMax = category.maxAge;
  if (b.minAge !== undefined) {
    const v = b.minAge === "" || b.minAge == null ? null : Math.trunc(Number(b.minAge));
    if (v != null && (!Number.isFinite(v) || v < 0)) return NextResponse.json({ error: "Ages must be positive numbers" }, { status: 400 });
    data.minAge = v; effMin = v;
  }
  if (b.maxAge !== undefined) {
    const v = b.maxAge === "" || b.maxAge == null ? null : Math.trunc(Number(b.maxAge));
    if (v != null && (!Number.isFinite(v) || v < 0)) return NextResponse.json({ error: "Ages must be positive numbers" }, { status: 400 });
    data.maxAge = v; effMax = v;
  }
  if (effMin != null && effMax != null && effMin > effMax)
    return NextResponse.json({ error: "Minimum age can't be greater than maximum age" }, { status: 400 });

  const updated = await prisma.category.update({ where: { id: categoryId }, data });
  return NextResponse.json(updated);
}
