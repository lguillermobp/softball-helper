import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadTryoutForAdmin } from "@/lib/tryout";

interface Params { params: Promise<{ slug: string; tryoutId: string }> }

export async function GET(_: NextRequest, { params }: Params) {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug, tryoutId } = await params;
  const r = await loadTryoutForAdmin(slug, tryoutId, me.id, !!me.isMasterAdmin);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });

  const tryout = await prisma.tryout.findUnique({
    where: { id: tryoutId },
    select: {
      id: true, name: true, scheduledAt: true, ratingMin: true, ratingMax: true, runMode: true, status: true,
      seasonId: true, categoryId: true,
      season: { select: { name: true } },
      category: { select: { name: true } },
      field: { select: { id: true, name: true } },
      skills: { orderBy: { order: "asc" }, select: { id: true, name: true, order: true } },
      evaluators: { orderBy: { id: "asc" }, select: { id: true, attendanceConfirmed: true, user: { select: { id: true, name: true, email: true } } } },
      participants: {
        orderBy: { sequenceOrder: "asc" },
        select: { id: true, sequenceOrder: true, attendanceConfirmed: true, prospect: { select: { id: true, name: true } } },
      },
    },
  });
  return NextResponse.json({ tryout });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug, tryoutId } = await params;
  const r = await loadTryoutForAdmin(slug, tryoutId, me.id, !!me.isMasterAdmin);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  if (r.tryout.status !== "SETUP") return NextResponse.json({ error: "The tryout has already started." }, { status: 409 });

  const b = await req.json();
  const data: Record<string, unknown> = {};
  if (b.name !== undefined) data.name = (b.name ?? "").toString().trim() || null;
  if (b.scheduledAt !== undefined) data.scheduledAt = b.scheduledAt ? new Date(b.scheduledAt) : null;
  if (b.fieldId !== undefined) {
    if (b.fieldId) {
      const f = await prisma.field.findFirst({ where: { id: b.fieldId, leagueId: r.league.id }, select: { id: true } });
      if (!f) return NextResponse.json({ error: "Invalid field." }, { status: 400 });
    }
    data.fieldId = b.fieldId || null;
  }
  if (b.ratingMin !== undefined || b.ratingMax !== undefined) {
    const cur = await prisma.tryout.findUnique({ where: { id: tryoutId }, select: { ratingMin: true, ratingMax: true } });
    const min = b.ratingMin !== undefined ? Math.trunc(+b.ratingMin) : cur!.ratingMin;
    const max = b.ratingMax !== undefined ? Math.trunc(+b.ratingMax) : cur!.ratingMax;
    if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max <= min)
      return NextResponse.json({ error: "Rating scale must go from a lower to a higher number." }, { status: 400 });
    data.ratingMin = min; data.ratingMax = max;
  }
  const updated = await prisma.tryout.update({ where: { id: tryoutId }, data, select: { id: true } });
  return NextResponse.json(updated);
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug, tryoutId } = await params;
  const r = await loadTryoutForAdmin(slug, tryoutId, me.id, !!me.isMasterAdmin);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  await prisma.tryout.delete({ where: { id: tryoutId } });
  return NextResponse.json({ success: true });
}
