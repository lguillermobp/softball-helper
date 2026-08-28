import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadTryoutForAdmin } from "@/lib/tryout";

interface Params { params: Promise<{ slug: string; tryoutId: string }> }

async function guard(slug: string, tryoutId: string, me: any) {
  const r = await loadTryoutForAdmin(slug, tryoutId, me.id, !!me.isMasterAdmin);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  if (r.tryout.status !== "SETUP") return NextResponse.json({ error: "The tryout has already started." }, { status: 409 });
  return { league: r.league, tryout: r.tryout };
}

/** Add prospects (from the tryout's own season + category) as participants, appended to the sequence. */
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug, tryoutId } = await params;
  const g = await guard(slug, tryoutId, me);
  if (g instanceof NextResponse) return g;
  const { tryout } = g;

  const body = await req.json();
  const prospectIds: string[] = Array.isArray(body.prospectIds) ? body.prospectIds.filter((x: unknown) => typeof x === "string") : [];
  if (prospectIds.length === 0) return NextResponse.json({ error: "Select at least one prospect." }, { status: 400 });

  const valid = await prisma.prospect.findMany({
    where: { id: { in: prospectIds }, seasonId: tryout.seasonId, categoryId: tryout.categoryId },
    select: { id: true },
  });
  const validIds = valid.map((v) => v.id);
  const existing = await prisma.tryoutParticipant.findMany({ where: { tryoutId, prospectId: { in: validIds } }, select: { prospectId: true } });
  const seen = new Set(existing.map((e) => e.prospectId));
  const toAdd = validIds.filter((id) => !seen.has(id));

  const last = await prisma.tryoutParticipant.findFirst({ where: { tryoutId }, orderBy: { sequenceOrder: "desc" }, select: { sequenceOrder: true } });
  let seq = last?.sequenceOrder ?? -1;
  if (toAdd.length) {
    await prisma.tryoutParticipant.createMany({ data: toAdd.map((pid) => ({ tryoutId, prospectId: pid, sequenceOrder: ++seq })) });
  }
  return NextResponse.json({ added: toAdd.length });
}

/** Reorder the evaluation sequence — body { order: participantId[] }. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug, tryoutId } = await params;
  const g = await guard(slug, tryoutId, me);
  if (g instanceof NextResponse) return g;

  const body = await req.json();
  const order: string[] = Array.isArray(body.order) ? body.order.filter((x: unknown) => typeof x === "string") : [];
  if (order.length === 0) return NextResponse.json({ error: "order is required" }, { status: 400 });
  await prisma.$transaction(order.map((id, i) =>
    prisma.tryoutParticipant.updateMany({ where: { id, tryoutId }, data: { sequenceOrder: i } })));
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug, tryoutId } = await params;
  const g = await guard(slug, tryoutId, me);
  if (g instanceof NextResponse) return g;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  await prisma.tryoutParticipant.deleteMany({ where: { id, tryoutId } });
  return NextResponse.json({ success: true });
}
