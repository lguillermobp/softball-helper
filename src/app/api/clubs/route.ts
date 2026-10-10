import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

// A user may create/own a club if they manage at least one team (directly) or are a master admin.
async function managesAnyTeam(userId: string): Promise<boolean> {
  const t = await prisma.team.findFirst({
    where: { OR: [{ managerId: userId }, { assistantId: userId }] },
    select: { id: true },
  });
  return !!t;
}

export async function GET() {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clubs = await prisma.club.findMany({
    where: { ownerId: me.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, name: true, slug: true, subdomain: true, createdAt: true,
      teams: {
        orderBy: { name: "asc" },
        select: { id: true, name: true, league: { select: { name: true, slug: true } } },
      },
    },
  });

  // Teams the user directly manages that aren't in a club yet — available to attach.
  const attachableTeams = await prisma.team.findMany({
    where: { clubId: null, OR: [{ managerId: me.id }, { assistantId: me.id }] },
    orderBy: { name: "asc" },
    select: { id: true, name: true, league: { select: { name: true, slug: true } } },
  });

  return NextResponse.json({ clubs, attachableTeams, canCreate: me.isMasterAdmin || attachableTeams.length > 0 || clubs.length > 0 });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!me.isMasterAdmin && !(await managesAnyTeam(me.id)))
    return NextResponse.json({ error: "Only team managers can create a club." }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const name = (b.name ?? "").toString().trim();
  if (name.length < 2 || name.length > 80)
    return NextResponse.json({ error: "Enter a club name between 2 and 80 characters." }, { status: 400 });

  const base = slugify(name) || "club";
  const existing = await prisma.club.findUnique({ where: { slug: base }, select: { id: true } });
  const slug = existing ? `${base}-${Date.now()}` : base;

  const club = await prisma.club.create({
    data: { name, slug, ownerId: me.id },
    select: { id: true, name: true, slug: true, createdAt: true },
  });
  return NextResponse.json({ club }, { status: 201 });
}
