import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadDraftForAdmin } from "@/lib/draft";

interface Params { params: Promise<{ slug: string; draftId: string }> }

/** Draw lots — randomise the pick order from the teams in this season-category. */
export async function POST(_: NextRequest, { params }: Params) {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug, draftId } = await params;
  const r = await loadDraftForAdmin(slug, draftId, me.id, !!me.isMasterAdmin);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  if (r.draft.status !== "SETUP") return NextResponse.json({ error: "The draft has already started." }, { status: 409 });

  const teamSeasons = await prisma.teamSeason.findMany({ where: { seasonId: r.draft.seasonId, categoryId: r.draft.categoryId }, select: { teamId: true } });
  const ids = teamSeasons.map((t) => t.teamId);
  if (ids.length < 2) return NextResponse.json({ error: "Add at least two teams to this season-category before drawing lots." }, { status: 400 });

  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  await prisma.draft.update({ where: { id: draftId }, data: { pickOrder: ids } });
  return NextResponse.json({ ok: true });
}
