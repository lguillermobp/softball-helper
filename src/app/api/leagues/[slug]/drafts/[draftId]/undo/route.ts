import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadDraftForAdmin } from "@/lib/draft";

interface Params { params: Promise<{ slug: string; draftId: string }> }

/** Undo the most recent draft pick (not keepers). Frees the prospect and removes the player. */
export async function POST(_: NextRequest, { params }: Params) {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug, draftId } = await params;
  const r = await loadDraftForAdmin(slug, draftId, me.id, !!me.isMasterAdmin);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  if (r.draft.status !== "LIVE") return NextResponse.json({ error: "The draft is not live." }, { status: 409 });

  const last = await prisma.draftPick.findFirst({ where: { draftId, isKeeper: false }, orderBy: { pickNumber: "desc" }, select: { id: true, prospectId: true } });
  if (!last) return NextResponse.json({ error: "There's nothing to undo." }, { status: 400 });

  const prospect = await prisma.prospect.findUnique({ where: { id: last.prospectId }, select: { playerId: true } });
  await prisma.$transaction(async (tx) => {
    await tx.draftPick.delete({ where: { id: last.id } });
    await tx.prospect.update({ where: { id: last.prospectId }, data: { status: "REGISTERED", playerId: null } });
    if (prospect?.playerId) await tx.player.delete({ where: { id: prospect.playerId } });
    await tx.draft.update({ where: { id: draftId }, data: { currentPick: { decrement: 1 } } });
  });
  return NextResponse.json({ ok: true });
}
