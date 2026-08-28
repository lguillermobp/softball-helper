import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadDraftForAdmin, computeDraftOrder, scoreTiers, tierIndexFor } from "@/lib/draft";

interface Params { params: Promise<{ slug: string; draftId: string }> }

/** Average tryout score per prospect (per-skill average, then overall) for a season-category. */
async function prospectScores(seasonId: string, categoryId: string) {
  const scores = await prisma.tryoutScore.findMany({
    where: { tryout: { seasonId, categoryId } },
    select: { rating: true, skillId: true, participant: { select: { prospectId: true } } },
  });
  const per = new Map<string, Map<string, { sum: number; n: number }>>();
  for (const s of scores) {
    const pid = s.participant.prospectId;
    if (!per.has(pid)) per.set(pid, new Map());
    const m = per.get(pid)!;
    const a = m.get(s.skillId) ?? { sum: 0, n: 0 };
    a.sum += s.rating; a.n += 1; m.set(s.skillId, a);
  }
  const out = new Map<string, number | null>();
  for (const [pid, m] of per) {
    const skillAvgs = [...m.values()].map((a) => a.sum / a.n);
    out.set(pid, skillAvgs.length ? Math.round((skillAvgs.reduce((x, y) => x + y, 0) / skillAvgs.length) * 100) / 100 : null);
  }
  return out;
}

export async function GET(_: NextRequest, { params }: Params) {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug, draftId } = await params;
  const r = await loadDraftForAdmin(slug, draftId, me.id, !!me.isMasterAdmin);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const d = r.draft;

  const [teamSeasons, prospects, picks, tryouts, scoreMap] = await Promise.all([
    prisma.teamSeason.findMany({ where: { seasonId: d.seasonId, categoryId: d.categoryId }, select: { team: { select: { id: true, name: true } } } }),
    prisma.prospect.findMany({ where: { seasonId: d.seasonId, categoryId: d.categoryId }, select: { id: true, name: true } }),
    prisma.draftPick.findMany({ where: { draftId }, orderBy: { pickNumber: "asc" }, select: { id: true, teamId: true, prospectId: true, isKeeper: true, pickNumber: true } }),
    prisma.tryout.findMany({ where: { seasonId: d.seasonId, categoryId: d.categoryId }, select: { ratingMin: true, ratingMax: true } }),
    prospectScores(d.seasonId, d.categoryId),
  ]);

  const teams = teamSeasons.map((ts) => ts.team);
  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? "";
  const prospName = (id: string) => prospects.find((p) => p.id === id)?.name ?? "";
  const ratingMax = Math.max(5, ...tryouts.map((t) => t.ratingMax));
  const ratingMin = Math.min(1, ...tryouts.map((t) => t.ratingMin));
  const tiers = scoreTiers(ratingMin, ratingMax);

  const pickedIds = new Set(picks.map((p) => p.prospectId));
  const keeperCounts: Record<string, number> = {};
  for (const t of teams) keeperCounts[t.id] = 0;
  for (const p of picks) if (p.isKeeper) keeperCounts[p.teamId] = (keeperCounts[p.teamId] ?? 0) + 1;

  const rosters = teams.map((t) => ({
    id: t.id, name: t.name,
    players: picks.filter((p) => p.teamId === t.id).map((p) => ({ prospectId: p.prospectId, name: prospName(p.prospectId), isKeeper: p.isKeeper, score: scoreMap.get(p.prospectId) ?? null })),
  }));

  const available = prospects.filter((p) => !pickedIds.has(p.id)).map((p) => {
    const score = scoreMap.get(p.id) ?? null;
    return { id: p.id, name: p.name, score, tier: tierIndexFor(score, tiers) };
  }).sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

  // on-the-clock / next when live
  let onClock: string | null = null, next: string | null = null;
  if (d.status === "LIVE" && d.pickOrder.length) {
    const totalToDraft = prospects.length - picks.filter((p) => p.isKeeper).length;
    const target = d.targetPerTeam ?? Math.max(1, Math.floor(prospects.length / teams.length));
    const order = computeDraftOrder(d.pickOrder, d.snake, keeperCounts, target, totalToDraft);
    onClock = order[d.currentPick] ?? null;
    next = order[d.currentPick + 1] ?? null;
  }

  return NextResponse.json({
    draft: {
      id: d.id, status: d.status, snake: d.snake, currentPick: d.currentPick,
      target: d.targetPerTeam,
      pickOrder: d.pickOrder.map((id) => ({ id, name: teamName(id) })),
      onClock: onClock ? { id: onClock, name: teamName(onClock) } : null,
      next: next ? { id: next, name: teamName(next) } : null,
      teamsTotal: teams.length,
      prospectsTotal: prospects.length,
      picksMade: picks.filter((p) => !p.isKeeper).length,
    },
    teams,
    rosters,
    available,
    tiers,
  });
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug, draftId } = await params;
  const r = await loadDraftForAdmin(slug, draftId, me.id, !!me.isMasterAdmin);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  if (r.draft.status !== "SETUP") return NextResponse.json({ error: "The draft has already started." }, { status: 409 });
  await prisma.draft.delete({ where: { id: draftId } });
  return NextResponse.json({ success: true });
}
