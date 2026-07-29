import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ faqId: string }> }

async function requireMasterAdmin() {
  const session = await auth();
  if (!(session?.user as any)?.isMasterAdmin) throw new Error("Forbidden");
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireMasterAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { faqId } = await params;
  const b = await req.json();

  const data: Record<string, unknown> = {};
  for (const k of ["category", "questionEn", "questionEs", "answerEn", "answerEs"] as const) {
    if (typeof b[k] === "string") data[k] = b[k].trim();
  }
  if (typeof b.order === "number") data.order = Math.trunc(b.order);
  if (typeof b.active === "boolean") data.active = b.active;

  const faq = await prisma.faq.update({ where: { id: faqId }, data });
  return NextResponse.json({ faq });
}

export async function DELETE(_: NextRequest, { params }: Params) {
  try {
    await requireMasterAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { faqId } = await params;
  await prisma.faq.delete({ where: { id: faqId } });
  return NextResponse.json({ success: true });
}
