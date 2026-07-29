import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireMasterAdmin() {
  const session = await auth();
  if (!(session?.user as any)?.isMasterAdmin) throw new Error("Forbidden");
  return session!;
}

export async function GET() {
  try {
    await requireMasterAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const faqs = await prisma.faq.findMany({ orderBy: [{ category: "asc" }, { order: "asc" }] });
  return NextResponse.json({ faqs });
}

export async function POST(req: NextRequest) {
  try {
    await requireMasterAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const b = await req.json();
  const questionEn = (b.questionEn ?? "").trim();
  const questionEs = (b.questionEs ?? "").trim();
  const answerEn = (b.answerEn ?? "").trim();
  const answerEs = (b.answerEs ?? "").trim();

  if (!questionEn || !questionEs || !answerEn || !answerEs)
    return NextResponse.json({ error: "All question and answer fields are required (both languages)" }, { status: 400 });

  const faq = await prisma.faq.create({
    data: {
      category: ((b.category ?? "").trim()) || "General",
      questionEn, questionEs, answerEn, answerEs,
      order: typeof b.order === "number" ? Math.trunc(b.order) : 0,
      active: b.active !== false,
    },
  });
  return NextResponse.json({ faq });
}
