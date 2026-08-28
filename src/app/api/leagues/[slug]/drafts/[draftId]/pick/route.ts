import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadDraftForAdmin, computeDraftOrder } from "@/lib/draft";

interface Params { params: Promise<{ slug: string; draftId: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug, draftId } = await params;
  const r = await loadDraftForAdmin(slug, draftId, me.id, !!me.isMasterAdmin);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const d = r.draft;
  if (d.status !== "LIVE") return NextResponse.json({ error: "The draft is not live." }, { status: 409 });

  const prospectId = ((await req.json()).prospectId ?? "").trim();
  if (!prospectId) return NextResponse.json({ error: "Pick a prospect." }, { status: 400 });

  const [picks, prospectsTotal, prospect] = await Promise.all([
    prisma.draftPick.findMany({ where: { draftId }, select: { teamId: true, isKeeper: true, prospectId: true, pickNumber: true } }),
    prisma.prospect.count({ where: { seasonId: d.seasonId, categoryId: d.categoryId } }),
    prisma.prospect.findFirst({ where: { id: prospectId, seasonId: d.seasonId, categoryId: d.categoryId }, select: { id: true, name: true, dob: true, photoUrl: true, nationality: true, email: true } }),
  ]);
  if (!prospect) return NextResponse.json({ error: "Invalid prospect." }, { status: 400 });
  if (picks.some((p) => p.prospectId === prospectId)) return NextResponse.json({ error: "That prospect is already taken." }, { status: 409 });

  const keeperCounts: Record<string, number> = {};
  for (const id of d.pickOrder) keeperCounts[id] = 0;
  for (const p of picks) if (p.isKeeper) keeperCounts[p.teamId] = (keeperCounts[p.teamId] ?? 0) + 1;
  const totalToDraft = prospectsTotal - picks.filter((p) => p.isKeeper).length;
  const target = d.targetPerTeam ?? Math.max(1, Math.floor(prospectsTotal / d.pickOrder.length));
  const order = computeDraftOrder(d.pickOrder, d.snake, keeperCounts, target, totalToDraft);
  const teamId = order[d.currentPick];
  if (!teamId) return NextResponse.json({ error: "Every pick has been made — finish the draft." }, { status: 409 });

  const pickNumber = Math.max(0, ...picks.map((p) => p.pickNumber)) + 1;

  await prisma.$transaction(async (tx) => {
    const player = await tx.player.create({
      data: {
        name: prospect.name, dob: prospect.dob, photoUrl: prospect.photoUrl, nationality: prospect.nationality,
        email: prospect.email, teamId, leagueId: r.league.id,
      },
      select: { id: true },
    });
    await tx.draftPick.create({ data: { draftId, teamId, prospectId, isKeeper: false, pickNumber, round: Math.floor(d.currentPick / d.pickOrder.length) } });
    await tx.prospect.update({ where: { id: prospectId }, data: { status: "DRAFTED", playerId: player.id } });
    await tx.draft.update({ where: { id: draftId }, data: { currentPick: { increment: 1 } } });
  });
  return NextResponse.json({ ok: true, teamId });
}
