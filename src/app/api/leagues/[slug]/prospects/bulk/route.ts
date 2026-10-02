import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAdminCategory } from "@/lib/tryout";

interface Params { params: Promise<{ slug: string }> }

interface Row {
  name: string;
  dob?: string | null;
  email?: string | null;
  phone?: string | null;
  parent1Name: string;
  parent1Email?: string | null;
  parent1Phone?: string | null;
  parent2Name?: string | null;
  parent2Email?: string | null;
  parent2Phone?: string | null;
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const league = await prisma.league.findUnique({
    where: { slug }, select: { id: true, status: true, usesTryoutDraft: true },
  });
  if (!league) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!league.usesTryoutDraft) return NextResponse.json({ error: "Tryouts & draft are not enabled for this league." }, { status: 400 });
  if (league.status === "SUSPENDED") return NextResponse.json({ error: "This league is currently suspended." }, { status: 423 });

  const { seasonId, categoryId, prospects } = await req.json() as {
    seasonId: string; categoryId: string; prospects: Row[];
  };
  if (!seasonId || !categoryId || !Array.isArray(prospects) || prospects.length === 0)
    return NextResponse.json({ error: "seasonId, categoryId and a non-empty prospects array are required." }, { status: 400 });

  // Season & category must belong to this league.
  const [category, season] = await Promise.all([
    prisma.category.findFirst({ where: { id: categoryId, leagueId: league.id }, select: { id: true } }),
    prisma.season.findFirst({ where: { id: seasonId, leagueId: league.id }, select: { id: true } }),
  ]);
  if (!category || !season) return NextResponse.json({ error: "Invalid season or category." }, { status: 400 });

  if (!(await canAdminCategory(me.id, !!me.isMasterAdmin, categoryId)))
    return NextResponse.json({ error: "You can only import prospects in categories you administer." }, { status: 403 });

  const str = (v: unknown) => { const s = (v ?? "").toString().trim(); return s || null; };
  const results: { name: string; status: "added" | "error"; message?: string }[] = [];

  for (const p of prospects) {
    const name = (p.name ?? "").toString().trim();
    const parent1Name = (p.parent1Name ?? "").toString().trim();
    if (!name) { results.push({ name: "(blank)", status: "error", message: "Name required" }); continue; }
    if (!parent1Name) { results.push({ name, status: "error", message: "Parent 1 name required" }); continue; }

    let dob: Date | null = null;
    if (p.dob) {
      const d = new Date(p.dob);
      if (isNaN(d.getTime())) { results.push({ name, status: "error", message: "Invalid date of birth" }); continue; }
      dob = d;
    }

    try {
      await prisma.prospect.create({
        data: {
          leagueId: league.id, seasonId, categoryId,
          name, dob,
          email: str(p.email), phone: str(p.phone),
          parent1Name, parent1Email: str(p.parent1Email), parent1Phone: str(p.parent1Phone),
          parent2Name: str(p.parent2Name), parent2Email: str(p.parent2Email), parent2Phone: str(p.parent2Phone),
        },
      });
      results.push({ name, status: "added" });
    } catch (err: unknown) {
      results.push({ name, status: "error", message: err instanceof Error ? err.message : "Unexpected error" });
    }
  }

  return NextResponse.json({ results });
}
