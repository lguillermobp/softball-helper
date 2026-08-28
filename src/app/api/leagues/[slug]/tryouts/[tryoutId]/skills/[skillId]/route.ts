import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadTryoutForAdmin } from "@/lib/tryout";

interface Params { params: Promise<{ slug: string; tryoutId: string; skillId: string }> }

export async function DELETE(_: NextRequest, { params }: Params) {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug, tryoutId, skillId } = await params;
  const r = await loadTryoutForAdmin(slug, tryoutId, me.id, !!me.isMasterAdmin);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  if (r.tryout.status !== "SETUP") return NextResponse.json({ error: "The tryout has already started." }, { status: 409 });
  await prisma.tryoutSkill.deleteMany({ where: { id: skillId, tryoutId } });
  return NextResponse.json({ success: true });
}
