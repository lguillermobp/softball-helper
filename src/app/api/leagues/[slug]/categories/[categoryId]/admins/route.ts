import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ slug: string; categoryId: string }> }

/** Only master admins and LEAGUE_ADMINs may appoint or remove category admins. */
async function requireLeagueAdmin(slug: string, userId: string, isMasterAdmin: boolean) {
  const league = await prisma.league.findUnique({
    where: { slug },
    select: { id: true, status: true, userRoles: { where: { userId, role: "LEAGUE_ADMIN" }, select: { id: true } } },
  });
  if (!league) return { error: "Not found" as const, status: 404 };
  if (!isMasterAdmin && league.userRoles.length === 0) return { error: "Forbidden" as const, status: 403 };
  return { league };
}

export async function GET(_: NextRequest, { params }: Params) {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug, categoryId } = await params;
  const r = await requireLeagueAdmin(slug, me.id, !!me.isMasterAdmin);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });

  const admins = await prisma.categoryAdmin.findMany({
    where: { categoryId, category: { leagueId: r.league.id } },
    select: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ admins: admins.map((a) => a.user) });
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug, categoryId } = await params;
  const r = await requireLeagueAdmin(slug, me.id, !!me.isMasterAdmin);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  if (r.league.status === "SUSPENDED") return NextResponse.json({ error: "This league is currently suspended." }, { status: 423 });

  const category = await prisma.category.findFirst({ where: { id: categoryId, leagueId: r.league.id }, select: { id: true } });
  if (!category) return NextResponse.json({ error: "Category not found" }, { status: 404 });

  const email = ((await req.json()).email ?? "").toString().trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "An email is required." }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, email: true } });
  if (!user) return NextResponse.json({ error: "No account found with that email. They must register first." }, { status: 404 });

  await prisma.categoryAdmin.upsert({
    where: { categoryId_userId: { categoryId, userId: user.id } },
    update: {},
    create: { categoryId, userId: user.id },
  });
  return NextResponse.json({ admin: { ...user } }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug, categoryId } = await params;
  const r = await requireLeagueAdmin(slug, me.id, !!me.isMasterAdmin);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });

  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });
  await prisma.categoryAdmin.deleteMany({ where: { categoryId, userId, category: { leagueId: r.league.id } } });
  return NextResponse.json({ success: true });
}
