import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ slug: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;

  const league = await prisma.league.findUnique({
    where: { slug },
    select: { id: true, userRoles: { where: { userId: me.id, role: "LEAGUE_ADMIN" }, select: { id: true } } },
  });
  if (!league) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!me.isMasterAdmin && league.userRoles.length === 0)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { notifyGameEnd, notifyEmail, notifyManagers, instagramEnabled, timezone } = await req.json();

  const updated = await prisma.league.update({
    where: { id: league.id },
    data: {
      ...(typeof notifyGameEnd === "boolean" && { notifyGameEnd }),
      ...(notifyEmail !== undefined && { notifyEmail: notifyEmail?.trim() || null }),
      ...(typeof notifyManagers === "boolean" && { notifyManagers }),
      ...(typeof instagramEnabled === "boolean" && { instagramEnabled }),
      ...(typeof timezone === "string" && timezone && { timezone }),
    },
    select: { notifyGameEnd: true, notifyEmail: true, notifyManagers: true, instagramEnabled: true, timezone: true },
  });

  return NextResponse.json(updated);
}
