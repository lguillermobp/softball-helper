import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadTryoutForAdmin } from "@/lib/tryout";
import { buildCells, cellIndex, type RunMode } from "@/lib/tryout-run";

interface Params { params: Promise<{ slug: string; tryoutId: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug, tryoutId } = await params;
  const r = await loadTryoutForAdmin(slug, tryoutId, me.id, !!me.isMasterAdmin);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  if (r.tryout.status !== "LIVE") return NextResponse.json({ error: "The tryout is not live." }, { status: 409 });

  const dir = (await req.json()).dir === -1 ? -1 : 1;
  const t = await prisma.tryout.findUnique({ where: { id: tryoutId }, select: { runMode: true, currentParticipantId: true, currentSkillId: true } });
  const [participants, skills] = await Promise.all([
    prisma.tryoutParticipant.findMany({ where: { tryoutId }, select: { id: true, sequenceOrder: true, attendanceConfirmed: true } }),
    prisma.tryoutSkill.findMany({ where: { tryoutId }, select: { id: true, order: true } }),
  ]);
  const cells = buildCells(participants, skills, (t!.runMode ?? "BY_PLAYER") as RunMode);
  if (cells.length === 0) return NextResponse.json({ error: "No active cells." }, { status: 400 });

  let idx = cellIndex(cells, t!.currentParticipantId, t!.currentSkillId);
  if (idx < 0) idx = 0;
  const newIdx = Math.min(Math.max(idx + dir, 0), cells.length - 1);
  await prisma.tryout.update({ where: { id: tryoutId }, data: { currentParticipantId: cells[newIdx].participantId, currentSkillId: cells[newIdx].skillId } });
  return NextResponse.json({ ok: true, position: newIdx + 1, total: cells.length, atEnd: newIdx === cells.length - 1 });
}
