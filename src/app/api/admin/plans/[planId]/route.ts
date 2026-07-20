import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ planId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!(session?.user as any)?.isMasterAdmin)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { planId } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if (body.name         != null) data.name          = body.name;
  if (body.price        != null) data.price         = parseFloat(body.price);
  if (body.maxTeams     != null) data.maxTeams      = parseInt(body.maxTeams);
  if (body.maxSeasons   != null) data.maxSeasons    = parseInt(body.maxSeasons);
  if (body.maxPlayers   != null) data.maxPlayers    = parseInt(body.maxPlayers);
  if (body.maxGames     != null) data.maxGames      = parseInt(body.maxGames);
  if (body.isActive     != null) data.isActive      = body.isActive;
  if ("stripePriceId" in body)   data.stripePriceId = body.stripePriceId || null;

  const plan = await prisma.plan.update({ where: { id: planId }, data });
  return NextResponse.json(plan);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!(session?.user as any)?.isMasterAdmin)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { planId } = await params;

  const leagueCount = await prisma.league.count({ where: { planId } });
  if (leagueCount > 0)
    return NextResponse.json(
      { error: `Cannot delete: ${leagueCount} league(s) are on this plan` },
      { status: 409 }
    );

  await prisma.plan.delete({ where: { id: planId } });
  return NextResponse.json({ success: true });
}
