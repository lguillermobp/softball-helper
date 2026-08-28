import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadTryoutForAdmin } from "@/lib/tryout";

interface Params { params: Promise<{ slug: string; tryoutId: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug, tryoutId } = await params;
  const r = await loadTryoutForAdmin(slug, tryoutId, me.id, !!me.isMasterAdmin);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  if (r.tryout.status !== "SETUP") return NextResponse.json({ error: "The tryout has already started." }, { status: 409 });

  const email = ((await req.json()).email ?? "").toString().trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "An email is required." }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, email: true } });
  if (!user) return NextResponse.json({ error: "No account found with that email. They must register first." }, { status: 404 });

  await prisma.tryoutEvaluator.upsert({
    where: { tryoutId_userId: { tryoutId, userId: user.id } },
    update: {},
    create: { tryoutId, userId: user.id },
  });
  return NextResponse.json({ evaluator: user }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug, tryoutId } = await params;
  const r = await loadTryoutForAdmin(slug, tryoutId, me.id, !!me.isMasterAdmin);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  if (r.tryout.status !== "SETUP") return NextResponse.json({ error: "The tryout has already started." }, { status: 409 });

  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });
  await prisma.tryoutEvaluator.deleteMany({ where: { tryoutId, userId } });
  return NextResponse.json({ success: true });
}
