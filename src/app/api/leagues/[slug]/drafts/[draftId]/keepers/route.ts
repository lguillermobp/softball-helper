import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadDraftForAdmin } from "@/lib/draft";

interface Params { params: Promise<{ slug: string; draftId: string }> }

async function guard(slug: string, draftId: string, me: any) {
  const r = await loadDraftForAdmin(slug, draftId, me.id, !!me.isMasterAdmin);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  if (r.draft.status !== "SETUP") return NextResponse.json({ error: "Keepers can only be set before the draft starts." }, { status: 409 });
  return r;
}

/** Assign a protected prospect (a returning player, a family member) directly to a team. */
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug, draftId } = await params;
  const g = await guard(slug, draftId, me);
  if (g instanceof NextResponse) return g;
  const { draft } = g;

  const b = await req.json();
  const teamId = (b.teamId ?? "").trim();
  const prospectId = (b.prospectId ?? "").trim();
  if (!teamId || !prospectId) return NextResponse.json({ error: "Team and prospect are required." }, { status: 400 });

  const [ts, prospect, taken] = await Promise.all([
    prisma.teamSeason.findFirst({ where: { teamId, seasonId: draft.seasonId, categoryId: draft.categoryId }, select: { teamId: true } }),
    prisma.prospect.findFirst({ where: { id: prospectId, seasonId: draft.seasonId, categoryId: draft.categoryId }, select: { id: true } }),
    prisma.draftPick.findUnique({ where: { draftId_prospectId: { draftId, prospectId } }, select: { id: true } }),
  ]);
  if (!ts) return NextResponse.json({ error: "That team isn't in this season-category." }, { status: 400 });
  if (!prospect) return NextResponse.json({ error: "Invalid prospect." }, { status: 400 });
  if (taken) return NextResponse.json({ error: "That prospect is already assigned." }, { status: 409 });

  await prisma.draftPick.create({ data: { draftId, teamId, prospectId, isKeeper: true } });
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug, draftId } = await params;
  const g = await guard(slug, draftId, me);
  if (g instanceof NextResponse) return g;

  const prospectId = req.nextUrl.searchParams.get("prospectId");
  if (!prospectId) return NextResponse.json({ error: "prospectId is required" }, { status: 400 });
  await prisma.draftPick.deleteMany({ where: { draftId, prospectId, isKeeper: true } });
  return NextResponse.json({ success: true });
}
