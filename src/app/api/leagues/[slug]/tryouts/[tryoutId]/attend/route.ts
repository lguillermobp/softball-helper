import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadTryoutForRun } from "@/lib/tryout";

interface Params { params: Promise<{ slug: string; tryoutId: string }> }

/** A coach confirms (or clears) their own attendance for the live session. */
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug, tryoutId } = await params;
  const r = await loadTryoutForRun(slug, tryoutId, me.id, !!me.isMasterAdmin);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  if (!r.evaluator) return NextResponse.json({ error: "You are not a coach on this tryout." }, { status: 403 });
  if (r.tryout.status === "DONE") return NextResponse.json({ error: "This tryout is finished." }, { status: 409 });

  const present = (await req.json()).present !== false;
  await prisma.tryoutEvaluator.update({
    where: { tryoutId_userId: { tryoutId, userId: me.id } },
    data: { attendanceConfirmed: present },
  });
  return NextResponse.json({ ok: true });
}
