import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadDraftForAdmin } from "@/lib/draft";

interface Params { params: Promise<{ slug: string; draftId: string }> }

export async function POST(_: NextRequest, { params }: Params) {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug, draftId } = await params;
  const r = await loadDraftForAdmin(slug, draftId, me.id, !!me.isMasterAdmin);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  if (r.draft.status !== "LIVE") return NextResponse.json({ error: "The draft is not live." }, { status: 409 });
  await prisma.draft.update({ where: { id: draftId }, data: { status: "DONE" } });
  return NextResponse.json({ ok: true });
}
