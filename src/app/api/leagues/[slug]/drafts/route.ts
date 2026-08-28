import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAdminCategory } from "@/lib/tryout";

interface Params { params: Promise<{ slug: string }> }

/** Get (or create) the single draft for a season + category. */
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug } = await params;
  const league = await prisma.league.findUnique({ where: { slug }, select: { id: true, usesTryoutDraft: true } });
  if (!league) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!league.usesTryoutDraft) return NextResponse.json({ error: "Tryouts & draft are not enabled." }, { status: 400 });

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
    return NextResponse.json({ error: "You can only run drafts in categories you administer." }, { status: 403 });

  const existing = await prisma.draft.findUnique({ where: { seasonId_categoryId: { seasonId, categoryId } }, select: { id: true } });
  if (existing) return NextResponse.json({ id: existing.id });
  const draft = await prisma.draft.create({ data: { seasonId, categoryId }, select: { id: true } });
  return NextResponse.json({ id: draft.id }, { status: 201 });
}
