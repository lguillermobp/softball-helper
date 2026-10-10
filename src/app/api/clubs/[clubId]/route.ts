import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadOwnedClub, clubEntitlements } from "@/lib/club";
import { validateSubdomain } from "@/lib/subdomain";

interface Params { params: Promise<{ clubId: string }> }

// Set or clear the club's subdomain (owner only).
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { clubId } = await params;
  const club = await loadOwnedClub(clubId, me.id, !!me.isMasterAdmin);
  if (!club) return NextResponse.json({ error: "Club not found" }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  if (!("subdomain" in b)) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  const raw = (b.subdomain ?? "").toString().trim();
  if (!raw) {
    await prisma.club.update({ where: { id: clubId }, data: { subdomain: null } });
    return NextResponse.json({ subdomain: null });
  }

  // Gate: a club with no subdomain must be entitled (Team Pro+) to claim one.
  // Clubs that already have one are grandfathered (may change or keep it).
  if (!club.subdomain) {
    const billing = await prisma.club.findUnique({
      where: { id: clubId },
      select: { subscriptionStatus: true, plan: { select: { name: true, allowSubdomain: true, allowAnalytics: true, maxTeams: true } } },
    });
    if (!clubEntitlements(billing!).subdomain)
      return NextResponse.json({ error: "Custom subdomains are available on Team Pro — upgrade the club to claim one." }, { status: 402 });
  }

  const v = validateSubdomain(raw);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const taken = await prisma.club.findFirst({ where: { subdomain: v.value, NOT: { id: clubId } }, select: { id: true } });
  if (taken) return NextResponse.json({ error: "That subdomain is already taken." }, { status: 409 });

  await prisma.club.update({ where: { id: clubId }, data: { subdomain: v.value } });
  return NextResponse.json({ subdomain: v.value });
}
