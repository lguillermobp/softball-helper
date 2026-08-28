import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadTryoutForAdmin } from "@/lib/tryout";

interface Params { params: Promise<{ slug: string; tryoutId: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug, tryoutId } = await params;
  const r = await loadTryoutForAdmin(slug, tryoutId, me.id, !!me.isMasterAdmin);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  if (r.tryout.status !== "SETUP") return NextResponse.json({ error: "The tryout has already started." }, { status: 409 });

  const name = ((await req.json()).name ?? "").toString().trim();
  if (!name) return NextResponse.json({ error: "A skill name is required." }, { status: 400 });
  const last = await prisma.tryoutSkill.findFirst({ where: { tryoutId }, orderBy: { order: "desc" }, select: { order: true } });
  const skill = await prisma.tryoutSkill.create({ data: { tryoutId, name, order: (last?.order ?? -1) + 1 } });
  return NextResponse.json({ skill }, { status: 201 });
}
