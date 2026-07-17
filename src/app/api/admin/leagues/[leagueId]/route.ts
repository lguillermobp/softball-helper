import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

interface Params { params: Promise<{ leagueId: string }> }

async function requireMasterAdmin() {
  const session = await auth();
  if (!(session?.user as any)?.isMasterAdmin)
    throw new Error("Forbidden");
  return session!;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try { await requireMasterAdmin(); } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { leagueId } = await params;
  const { status } = await req.json();

  if (status !== "ACTIVE" && status !== "SUSPENDED") {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const league = await prisma.league.findUnique({ where: { id: leagueId } });
  if (!league) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.league.update({
    where: { id: leagueId },
    data: { status },
  });

  return NextResponse.json({ id: updated.id, status: updated.status });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try { await requireMasterAdmin(); } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { leagueId } = await params;
  const { confirmName } = await req.json();

  const league = await prisma.league.findUnique({ where: { id: leagueId } });
  if (!league) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (confirmName !== league.name) {
    return NextResponse.json({ error: "League name does not match" }, { status: 400 });
  }

  if (league.stripeSubscriptionId) {
    try {
      await stripe.subscriptions.cancel(league.stripeSubscriptionId);
    } catch {
      // Subscription may already be cancelled — proceed with delete
    }
  }

  await prisma.league.delete({ where: { id: leagueId } });

  return NextResponse.json({ success: true });
}
