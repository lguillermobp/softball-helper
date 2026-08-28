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
  const d = r.draft;
  if (d.status !== "SETUP") return NextResponse.json({ error: "The draft has already started." }, { status: 409 });

  const [teamSeasons, prospectCount] = await Promise.all([
    prisma.teamSeason.findMany({ where: { seasonId: d.seasonId, categoryId: d.categoryId }, select: { teamId: true } }),
    prisma.prospect.count({ where: { seasonId: d.seasonId, categoryId: d.categoryId } }),
  ]);
  const teamIds = new Set(teamSeasons.map((t) => t.teamId));
  if (teamIds.size < 2) return NextResponse.json({ error: "Add at least two teams first." }, { status: 400 });
  if (prospectCount === 0) return NextResponse.json({ error: "There are no prospects to draft." }, { status: 400 });
  if (d.pickOrder.length !== teamIds.size || !d.pickOrder.every((id) => teamIds.has(id)))
    return NextResponse.json({ error: "Draw lots for the current teams first." }, { status: 400 });

  const target = Math.max(1, Math.floor(prospectCount / teamIds.size));

  // Lock in keepers: each protected prospect becomes a Player on its team now.
  const keepers = await prisma.draftPick.findMany({ where: { draftId, isKeeper: true }, select: { teamId: true, prospectId: true } });
  await prisma.$transaction(async (tx) => {
    for (const k of keepers) {
      const pr = await tx.prospect.findUnique({ where: { id: k.prospectId }, select: { name: true, dob: true, photoUrl: true, nationality: true, email: true, playerId: true } });
      if (pr && !pr.playerId) {
        const player = await tx.player.create({ data: { name: pr.name, dob: pr.dob, photoUrl: pr.photoUrl, nationality: pr.nationality, email: pr.email, teamId: k.teamId, leagueId: r.league.id } });
        await tx.prospect.update({ where: { id: k.prospectId }, data: { status: "DRAFTED", playerId: player.id } });
      }
    }
    await tx.draft.update({ where: { id: draftId }, data: { status: "LIVE", targetPerTeam: target, currentPick: 0 } });
  });
  return NextResponse.json({ ok: true });
}
