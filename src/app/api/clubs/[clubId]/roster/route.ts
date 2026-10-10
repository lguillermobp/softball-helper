import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadOwnedClub } from "@/lib/club";
import { normName, dobConflict } from "@/lib/profiles";

interface Params { params: Promise<{ clubId: string }> }

export async function GET(_: NextRequest, { params }: Params) {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { clubId } = await params;
  const club = await loadOwnedClub(clubId, me.id, !!me.isMasterAdmin);
  if (!club) return NextResponse.json({ error: "Club not found" }, { status: 404 });

  const profiles = await prisma.playerProfile.findMany({
    where: { clubId },
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, dob: true, emails: true,
      players: {
        select: { id: true, name: true, team: { select: { name: true, league: { select: { name: true } } } } },
      },
    },
  });

  const distinct = await prisma.distinctPair.findMany({ where: { clubId }, select: { profile1: true, profile2: true } });
  const blocked = new Set(distinct.map((d) => [d.profile1, d.profile2].sort().join("|")));

  // Suggested duplicates: same-name profiles whose DOBs don't conflict and aren't kept-separate.
  const byName = new Map<string, typeof profiles>();
  for (const p of profiles) {
    const k = normName(p.name);
    if (!k) continue;
    let arr = byName.get(k);
    if (!arr) { arr = []; byName.set(k, arr); }
    arr.push(p);
  }
  const summary = (p: (typeof profiles)[number]) => ({
    id: p.id, name: p.name, dob: p.dob,
    leagues: [...new Set(p.players.map((pl) => pl.team.league.name))],
    teamCount: p.players.length,
  });
  const suggestions: { a: ReturnType<typeof summary>; b: ReturnType<typeof summary> }[] = [];
  for (const group of byName.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i], b = group[j];
        if (dobConflict(a.dob, b.dob)) continue;
        if (blocked.has([a.id, b.id].sort().join("|"))) continue;
        suggestions.push({ a: summary(a), b: summary(b) });
      }
    }
  }

  const [unlinked, merges] = await Promise.all([
    prisma.player.count({ where: { team: { clubId }, profileId: null } }),
    prisma.profileMerge.findMany({
      where: { clubId, undone: false },
      orderBy: { createdAt: "desc" }, take: 10,
      select: { id: true, mergedName: true, createdAt: true },
    }),
  ]);

  return NextResponse.json({ club: { id: club.id, name: club.name }, profiles, suggestions, unlinked, merges });
}
