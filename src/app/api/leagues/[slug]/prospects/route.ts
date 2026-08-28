import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAdminCategory, adminCategoryIds } from "@/lib/tryout";

interface Params { params: Promise<{ slug: string }> }

async function leagueFor(slug: string) {
  return prisma.league.findUnique({ where: { slug }, select: { id: true, status: true, usesTryoutDraft: true } });
}

export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug } = await params;
  const league = await leagueFor(slug);
  if (!league) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!league.usesTryoutDraft) return NextResponse.json({ prospects: [] });

  const allowed = await adminCategoryIds(me.id, !!me.isMasterAdmin, league.id);
  if (allowed !== "ALL" && allowed.length === 0) return NextResponse.json({ prospects: [] });

  const seasonId = req.nextUrl.searchParams.get("seasonId") || undefined;
  const categoryId = req.nextUrl.searchParams.get("categoryId") || undefined;

  const prospects = await prisma.prospect.findMany({
    where: {
      leagueId: league.id,
      ...(seasonId ? { seasonId } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(allowed === "ALL" ? {} : { categoryId: categoryId && allowed.includes(categoryId) ? categoryId : { in: allowed } }),
    },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true, name: true, dob: true, email: true, phone: true, photoUrl: true, nationality: true,
      parent1Name: true, parent1Email: true, parent1Phone: true,
      parent2Name: true, parent2Email: true, parent2Phone: true,
      status: true, seasonId: true, categoryId: true,
      category: { select: { name: true } },
    },
  });
  return NextResponse.json({ prospects });
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug } = await params;
  const league = await leagueFor(slug);
  if (!league) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!league.usesTryoutDraft) return NextResponse.json({ error: "Tryouts & draft are not enabled for this league." }, { status: 400 });
  if (league.status === "SUSPENDED") return NextResponse.json({ error: "This league is currently suspended." }, { status: 423 });

  const b = await req.json();
  const name = (b.name ?? "").trim();
  const seasonId = (b.seasonId ?? "").trim();
  const categoryId = (b.categoryId ?? "").trim();
  if (!name) return NextResponse.json({ error: "The prospect's name is required." }, { status: 400 });
  if (!seasonId || !categoryId) return NextResponse.json({ error: "Season and category are required." }, { status: 400 });

  // category & season must belong to this league
  const [category, season] = await Promise.all([
    prisma.category.findFirst({ where: { id: categoryId, leagueId: league.id }, select: { id: true } }),
    prisma.season.findFirst({ where: { id: seasonId, leagueId: league.id }, select: { id: true } }),
  ]);
  if (!category || !season) return NextResponse.json({ error: "Invalid season or category." }, { status: 400 });

  if (!(await canAdminCategory(me.id, !!me.isMasterAdmin, categoryId)))
    return NextResponse.json({ error: "You can only register prospects in categories you administer." }, { status: 403 });

  const parent1Name = (b.parent1Name ?? "").trim();
  if (!parent1Name) return NextResponse.json({ error: "Parent 1 name is required." }, { status: 400 });

  const str = (v: unknown) => { const s = (v ?? "").toString().trim(); return s || null; };

  const prospect = await prisma.prospect.create({
    data: {
      leagueId: league.id, seasonId, categoryId,
      name,
      email: str(b.email), phone: str(b.phone), nationality: str(b.nationality),
      dob: b.dob ? new Date(b.dob) : null,
      parent1Name, parent1Email: str(b.parent1Email), parent1Phone: str(b.parent1Phone),
      parent2Name: str(b.parent2Name), parent2Email: str(b.parent2Email), parent2Phone: str(b.parent2Phone),
    },
  });
  return NextResponse.json(prospect, { status: 201 });
}
