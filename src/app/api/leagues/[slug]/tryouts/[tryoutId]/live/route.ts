import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadTryoutForRun } from "@/lib/tryout";
import { buildCells, cellIndex, type RunMode } from "@/lib/tryout-run";

interface Params { params: Promise<{ slug: string; tryoutId: string }> }

export async function GET(_: NextRequest, { params }: Params) {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug, tryoutId } = await params;
  const r = await loadTryoutForRun(slug, tryoutId, me.id, !!me.isMasterAdmin);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const { tryout, isAdmin, evaluator } = r;

  const [participants, skills, evaluators] = await Promise.all([
    prisma.tryoutParticipant.findMany({
      where: { tryoutId }, orderBy: { sequenceOrder: "asc" },
      select: { id: true, sequenceOrder: true, attendanceConfirmed: true, prospect: { select: { name: true } } },
    }),
    prisma.tryoutSkill.findMany({ where: { tryoutId }, orderBy: { order: "asc" }, select: { id: true, name: true, order: true } }),
    prisma.tryoutEvaluator.findMany({
      where: { tryoutId }, select: { attendanceConfirmed: true, user: { select: { id: true, name: true, email: true } } },
    }),
  ]);

  const skillName = (id: string) => skills.find((s) => s.id === id)?.name ?? "";
  const partName = (id: string) => participants.find((p) => p.id === id)?.prospect.name ?? "";

  const cells = buildCells(participants, skills, (tryout.runMode ?? "BY_PLAYER") as RunMode);
  let idx = cellIndex(cells, tryout.currentParticipantId, tryout.currentSkillId);
  if (idx < 0 && cells.length && tryout.status === "LIVE") idx = 0;

  const cur = idx >= 0 ? cells[idx] : null;
  const nxt = idx >= 0 && idx + 1 < cells.length ? cells[idx + 1] : null;

  const presentCoaches = evaluators.filter((e) => e.attendanceConfirmed).length;
  let scored = 0, myRating: number | null = null, myNote: string | null = null;
  if (cur) {
    scored = await prisma.tryoutScore.count({ where: { tryoutId, participantId: cur.participantId, skillId: cur.skillId } });
    if (evaluator) {
      const mine = await prisma.tryoutScore.findFirst({
        where: { tryoutId, participantId: cur.participantId, skillId: cur.skillId, evaluator: { userId: me.id } },
        select: { rating: true, note: true },
      });
      myRating = mine?.rating ?? null; myNote = mine?.note ?? null;
    }
  }

  return NextResponse.json({
    status: tryout.status,
    runMode: tryout.runMode,
    name: tryout.name,
    ratingMin: tryout.ratingMin,
    ratingMax: tryout.ratingMax,
    isAdmin,
    current: cur ? { participantId: cur.participantId, participantName: partName(cur.participantId), skillId: cur.skillId, skillName: skillName(cur.skillId), position: idx + 1, total: cells.length } : null,
    next: nxt ? { participantName: partName(nxt.participantId), skillName: skillName(nxt.skillId) } : null,
    tally: { scored, present: presentCoaches, total: evaluators.length },
    me: { isEvaluator: !!evaluator, attendanceConfirmed: evaluator?.attendanceConfirmed ?? false, rating: myRating, note: myNote },
    ...(isAdmin ? {
      participants: participants.map((p) => ({ id: p.id, name: p.prospect.name, attendanceConfirmed: p.attendanceConfirmed })),
      evaluators: evaluators.map((e) => ({ userId: e.user.id, name: e.user.name ?? e.user.email, attendanceConfirmed: e.attendanceConfirmed })),
    } : {}),
  });
}
