import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadTryoutForAdmin } from "@/lib/tryout";

interface Params { params: Promise<{ slug: string; tryoutId: string }> }

/**
 * Ranked pool: per skill = average of coaches' ratings; overall = average of the
 * skill averages (equal weight); prospects sorted by overall descending.
 */
export async function GET(_: NextRequest, { params }: Params) {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug, tryoutId } = await params;
  const r = await loadTryoutForAdmin(slug, tryoutId, me.id, !!me.isMasterAdmin);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });

  const [participants, skills, scores] = await Promise.all([
    prisma.tryoutParticipant.findMany({ where: { tryoutId }, orderBy: { sequenceOrder: "asc" }, select: { id: true, prospect: { select: { id: true, name: true } } } }),
    prisma.tryoutSkill.findMany({ where: { tryoutId }, orderBy: { order: "asc" }, select: { id: true, name: true } }),
    prisma.tryoutScore.findMany({ where: { tryoutId }, select: { participantId: true, skillId: true, rating: true } }),
  ]);

  // sum + count per (participant, skill)
  const acc = new Map<string, { sum: number; n: number }>();
  for (const s of scores) {
    const k = `${s.participantId}:${s.skillId}`;
    const a = acc.get(k) ?? { sum: 0, n: 0 };
    a.sum += s.rating; a.n += 1; acc.set(k, a);
  }

  const rows = participants.map((p) => {
    const perSkill: Record<string, number | null> = {};
    const skillAverages: number[] = [];
    for (const sk of skills) {
      const a = acc.get(`${p.id}:${sk.id}`);
      const avg = a && a.n > 0 ? a.sum / a.n : null;
      perSkill[sk.name] = avg == null ? null : Math.round(avg * 100) / 100;
      if (avg != null) skillAverages.push(avg);
    }
    const overall = skillAverages.length ? skillAverages.reduce((x, y) => x + y, 0) / skillAverages.length : null;
    return {
      prospectId: p.prospect.id,
      name: p.prospect.name,
      overall: overall == null ? null : Math.round(overall * 100) / 100,
      perSkill,
    };
  });

  rows.sort((a, b) => (b.overall ?? -1) - (a.overall ?? -1));
  return NextResponse.json({ skills: skills.map((s) => s.name), results: rows });
}
