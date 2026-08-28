import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadTryoutForAdmin } from "@/lib/tryout";

interface Params { params: Promise<{ slug: string; tryoutId: string }> }

/** Admin marks a participant present/absent. Allowed during setup or a live run. */
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug, tryoutId } = await params;
  const r = await loadTryoutForAdmin(slug, tryoutId, me.id, !!me.isMasterAdmin);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  if (r.tryout.status === "DONE") return NextResponse.json({ error: "This tryout is finished." }, { status: 409 });

  const b = await req.json();
  const participantId = (b.participantId ?? "").toString();
  if (!participantId) return NextResponse.json({ error: "participantId is required" }, { status: 400 });
  await prisma.tryoutParticipant.updateMany({ where: { id: participantId, tryoutId }, data: { attendanceConfirmed: b.present !== false } });
  return NextResponse.json({ ok: true });
}
