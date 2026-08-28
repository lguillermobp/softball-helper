import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAdminCategory, adminCategoryIds } from "@/lib/tryout";

interface Params { params: Promise<{ slug: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug } = await params;
  const league = await prisma.league.findUnique({ where: { slug }, select: { id: true, usesTryoutDraft: true } });
  if (!league) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!league.usesTryoutDraft) return NextResponse.json({ tryouts: [] });

  const allowed = await adminCategoryIds(me.id, !!me.isMasterAdmin, league.id);
  if (allowed !== "ALL" && allowed.length === 0) return NextResponse.json({ tryouts: [] });

  const seasonId = req.nextUrl.searchParams.get("seasonId") || undefined;
  const categoryId = req.nextUrl.searchParams.get("categoryId") || undefined;

  const tryouts = await prisma.tryout.findMany({
    where: {
      season: { leagueId: league.id },
      ...(seasonId ? { seasonId } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(allowed === "ALL" ? {} : { categoryId: { in: allowed } }),
    },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
    select: {
      id: true, name: true, scheduledAt: true, status: true, runMode: true,
      seasonId: true, categoryId: true,
      category: { select: { name: true } },
      field: { select: { name: true } },
      _count: { select: { participants: true, evaluators: true, skills: true } },
    },
  });
  return NextResponse.json({ tryouts });
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug } = await params;
  const league = await prisma.league.findUnique({ where: { slug }, select: { id: true, status: true, usesTryoutDraft: true } });
  if (!league) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!league.usesTryoutDraft) return NextResponse.json({ error: "Tryouts & draft are not enabled for this league." }, { status: 400 });
  if (league.status === "SUSPENDED") return NextResponse.json({ error: "This league is currently suspended." }, { status: 423 });

  const b = await req.json();
  const seasonId = (b.seasonId ?? "").trim();
  const categoryId = (b.categoryId ?? "").trim();
  if (!seasonId || !categoryId) return NextResponse.json({ error: "Season and category are required." }, { status: 400 });

  const [category, season] = await Promise.all([
    prisma.category.findFirst({ where: { id: categoryId, leagueId: league.id }, select: { id: true } }),
    prisma.season.findFirst({ where: { id: seasonId, leagueId: league.id }, select: { id: true } }),
  ]);
  if (!category || !season) return NextResponse.json({ error: "Invalid season or category." }, { status: 400 });
  if (!(await canAdminCategory(me.id, !!me.isMasterAdmin, categoryId)))
    return NextResponse.json({ error: "You can only create tryouts in categories you administer." }, { status: 403 });

  if (b.fieldId) {
    const f = await prisma.field.findFirst({ where: { id: b.fieldId, leagueId: league.id }, select: { id: true } });
    if (!f) return NextResponse.json({ error: "Invalid field." }, { status: 400 });
  }

  const ratingMin = Number.isFinite(+b.ratingMin) ? Math.trunc(+b.ratingMin) : 1;
  const ratingMax = Number.isFinite(+b.ratingMax) ? Math.trunc(+b.ratingMax) : 5;
  if (ratingMin < 0 || ratingMax <= ratingMin) return NextResponse.json({ error: "Rating scale must go from a lower to a higher number." }, { status: 400 });

  const skills: string[] = Array.isArray(b.skills)
    ? b.skills.map((s: unknown) => (s ?? "").toString().trim()).filter(Boolean)
    : [];
  if (skills.length === 0) return NextResponse.json({ error: "Add at least one skill to assess." }, { status: 400 });

  const tryout = await prisma.tryout.create({
    data: {
      seasonId, categoryId,
      name: (b.name ?? "").toString().trim() || null,
      scheduledAt: b.scheduledAt ? new Date(b.scheduledAt) : null,
      fieldId: b.fieldId || null,
      ratingMin, ratingMax,
      skills: { create: skills.map((name, i) => ({ name, order: i })) },
    },
    select: { id: true },
  });
  return NextResponse.json({ id: tryout.id }, { status: 201 });
}
