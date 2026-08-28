import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadTryoutForRun } from "@/lib/tryout";

interface Params { params: Promise<{ slug: string; tryoutId: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug, tryoutId } = await params;
  const r = await loadTryoutForRun(slug, tryoutId, me.id, !!me.isMasterAdmin);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const { tryout, evaluator } = r;
  if (!evaluator) return NextResponse.json({ error: "Only assigned coaches can score." }, { status: 403 });
  if (tryout.status !== "LIVE") return NextResponse.json({ error: "The tryout is not live." }, { status: 409 });
  if (!evaluator.attendanceConfirmed) return NextResponse.json({ error: "Confirm your attendance before scoring." }, { status: 409 });
  if (!tryout.currentParticipantId || !tryout.currentSkillId)
    return NextResponse.json({ error: "No player is up right now." }, { status: 409 });

  const b = await req.json();
  const rating = Math.trunc(Number(b.rating));
  if (!Number.isFinite(rating) || rating < tryout.ratingMin || rating > tryout.ratingMax)
    return NextResponse.json({ error: `Rating must be a whole number from ${tryout.ratingMin} to ${tryout.ratingMax}.` }, { status: 400 });
  const note = (b.note ?? "").toString().trim() || null;

  await prisma.tryoutScore.upsert({
    where: { participantId_skillId_evaluatorId: { participantId: tryout.currentParticipantId, skillId: tryout.currentSkillId, evaluatorId: evaluator.id } },
    update: { rating, note },
    create: { tryoutId, participantId: tryout.currentParticipantId, skillId: tryout.currentSkillId, evaluatorId: evaluator.id, rating, note },
  });
  return NextResponse.json({ ok: true });
}
