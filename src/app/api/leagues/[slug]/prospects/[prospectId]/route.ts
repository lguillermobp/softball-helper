import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAdminCategory } from "@/lib/tryout";

interface Params { params: Promise<{ slug: string; prospectId: string }> }

async function loadProspect(slug: string, prospectId: string) {
  const league = await prisma.league.findUnique({ where: { slug }, select: { id: true, status: true } });
  if (!league) return { error: "Not found" as const, status: 404 };
  const prospect = await prisma.prospect.findFirst({
    where: { id: prospectId, leagueId: league.id },
    select: { id: true, categoryId: true },
  });
  if (!prospect) return { error: "Prospect not found" as const, status: 404 };
  return { league, prospect };
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug, prospectId } = await params;
  const r = await loadProspect(slug, prospectId);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  if (r.league.status === "SUSPENDED") return NextResponse.json({ error: "This league is currently suspended." }, { status: 423 });

  if (!(await canAdminCategory(me.id, !!me.isMasterAdmin, r.prospect.categoryId)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const b = await req.json();
  const str = (v: unknown) => { const s = (v ?? "").toString().trim(); return s || null; };
  const data: Record<string, unknown> = {};
  if (typeof b.name === "string" && b.name.trim()) data.name = b.name.trim();
  for (const k of ["email", "phone", "nationality", "parent1Email", "parent1Phone", "parent2Name", "parent2Email", "parent2Phone"] as const)
    if (b[k] !== undefined) data[k] = str(b[k]);
  if (b.parent1Name !== undefined) {
    if (!(b.parent1Name ?? "").toString().trim()) return NextResponse.json({ error: "Parent 1 name is required." }, { status: 400 });
    data.parent1Name = b.parent1Name.trim();
  }
  if (b.dob !== undefined) data.dob = b.dob ? new Date(b.dob) : null;

  // allow moving to another category the user also administers
  if (typeof b.categoryId === "string" && b.categoryId && b.categoryId !== r.prospect.categoryId) {
    const cat = await prisma.category.findFirst({ where: { id: b.categoryId, leagueId: r.league.id }, select: { id: true } });
    if (!cat) return NextResponse.json({ error: "Invalid category." }, { status: 400 });
    if (!(await canAdminCategory(me.id, !!me.isMasterAdmin, b.categoryId)))
      return NextResponse.json({ error: "You can't move a prospect into a category you don't administer." }, { status: 403 });
    data.categoryId = b.categoryId;
  }

  const updated = await prisma.prospect.update({ where: { id: prospectId }, data });
  return NextResponse.json(updated);
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug, prospectId } = await params;
  const r = await loadProspect(slug, prospectId);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  if (!(await canAdminCategory(me.id, !!me.isMasterAdmin, r.prospect.categoryId)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await prisma.prospect.delete({ where: { id: prospectId } });
  return NextResponse.json({ success: true });
}
