import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadTryoutForAdmin } from "@/lib/tryout";
import { buildCells, type RunMode } from "@/lib/tryout-run";

interface Params { params: Promise<{ slug: string; tryoutId: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug, tryoutId } = await params;
  const r = await loadTryoutForAdmin(slug, tryoutId, me.id, !!me.isMasterAdmin);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  if (r.tryout.status !== "SETUP") return NextResponse.json({ error: "This tryout has already started." }, { status: 409 });

  const runMode = (await req.json()).runMode as RunMode;
  if (runMode !== "BY_SKILL" && runMode !== "BY_PLAYER")
    return NextResponse.json({ error: "Choose how to run the tryout: by skill or by player." }, { status: 400 });

  const [participants, skills] = await Promise.all([
    prisma.tryoutParticipant.findMany({ where: { tryoutId }, select: { id: true, sequenceOrder: true, attendanceConfirmed: true } }),
    prisma.tryoutSkill.findMany({ where: { tryoutId }, select: { id: true, order: true } }),
  ]);
  const cells = buildCells(participants, skills, runMode);
  if (cells.length === 0)
    return NextResponse.json({ error: "Confirm at least one present player and add at least one skill first." }, { status: 400 });

  await prisma.tryout.update({
    where: { id: tryoutId },
    data: { status: "LIVE", runMode, currentParticipantId: cells[0].participantId, currentSkillId: cells[0].skillId },
  });
  return NextResponse.json({ ok: true });
}
