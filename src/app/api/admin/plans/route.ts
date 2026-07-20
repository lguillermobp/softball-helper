import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!(session?.user as any)?.isMasterAdmin)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const plans = await prisma.plan.findMany({
    orderBy: { price: "asc" },
    include: { _count: { select: { leagues: true } } },
  });

  return NextResponse.json(plans);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!(session?.user as any)?.isMasterAdmin)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, price, maxTeams, maxSeasons, maxPlayers, maxGames, stripePriceId } = await req.json();

  if (!name || price == null || !maxTeams || !maxSeasons || !maxPlayers || !maxGames)
    return NextResponse.json({ error: "All fields except Stripe Price ID are required" }, { status: 400 });

  const plan = await prisma.plan.create({
    data: {
      name,
      price:         parseFloat(price),
      maxTeams:      parseInt(maxTeams),
      maxSeasons:    parseInt(maxSeasons),
      maxPlayers:    parseInt(maxPlayers),
      maxGames:      parseInt(maxGames),
      stripePriceId: stripePriceId || null,
    },
  });

  return NextResponse.json(plan, { status: 201 });
}
