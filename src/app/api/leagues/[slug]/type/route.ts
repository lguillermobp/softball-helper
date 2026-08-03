import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ slug: string }> }

const VALID_TYPES = ["SOFTBALL", "BASEBALL", "KICKBALL"] as const;
type LeagueTypeValue = (typeof VALID_TYPES)[number];

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;

  const league = await prisma.league.findUnique({
    where: { slug },
    select: { id: true, status: true, userRoles: { where: { userId: me.id, role: "LEAGUE_ADMIN" }, select: { id: true } } },
  });
  if (!league) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!me.isMasterAdmin && league.userRoles.length === 0)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (league.status === "SUSPENDED") return NextResponse.json({ error: "This league is currently suspended." }, { status: 423 });

  const { type } = await req.json();
  if (!VALID_TYPES.includes(type as LeagueTypeValue))
    return NextResponse.json({ error: "Invalid league type" }, { status: 400 });

  const updated = await prisma.league.update({
    where: { id: league.id },
    data: { type: type as LeagueTypeValue },
    select: { type: true },
  });

  return NextResponse.json(updated);
}
