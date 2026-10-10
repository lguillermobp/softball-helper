import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadOwnedClub } from "@/lib/club";
import { matchPlayer, normEmail, type ProfileLike } from "@/lib/profiles";

interface Params { params: Promise<{ clubId: string }> }

// Link every not-yet-linked player in the club into a profile: auto-link on a strong
// match, otherwise create a new profile. Existing profiles and links are never changed,
// so profile ids stay stable (merges / keep-separate decisions survive a rebuild).
export async function POST(_: NextRequest, { params }: Params) {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { clubId } = await params;
  const club = await loadOwnedClub(clubId, me.id, !!me.isMasterAdmin);
  if (!club) return NextResponse.json({ error: "Club not found" }, { status: 404 });

  const players = await prisma.player.findMany({
    where: { team: { clubId }, profileId: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, dob: true },
  });

  const existing = await prisma.playerProfile.findMany({
    where: { clubId }, select: { id: true, name: true, dob: true, emails: true },
  });
  const profiles: ProfileLike[] = existing.map((p) => ({ id: p.id, name: p.name, dob: p.dob, emails: [...p.emails] }));

  let linked = 0, created = 0;
  for (const p of players) {
    const pe = normEmail(p.email);
    const targetId = matchPlayer(p, profiles);

    if (targetId) {
      const prof = profiles.find((x) => x.id === targetId)!;
      const addEmail = !!pe && !prof.emails.includes(pe);
      const setDob = !prof.dob && !!p.dob;
      await prisma.$transaction([
        prisma.player.update({ where: { id: p.id }, data: { profileId: targetId } }),
        prisma.playerProfile.update({
          where: { id: targetId },
          data: { ...(addEmail ? { emails: { push: pe! } } : {}), ...(setDob ? { dob: p.dob } : {}) },
        }),
      ]);
      if (addEmail) prof.emails.push(pe!);
      if (setDob) prof.dob = p.dob;
      linked++;
    } else {
      const prof = await prisma.playerProfile.create({
        data: { clubId, name: p.name, dob: p.dob ?? null, emails: pe ? [pe] : [] },
        select: { id: true, name: true, dob: true, emails: true },
      });
      await prisma.player.update({ where: { id: p.id }, data: { profileId: prof.id } });
      profiles.push({ id: prof.id, name: prof.name, dob: prof.dob, emails: [...prof.emails] });
      created++;
    }
  }

  return NextResponse.json({ processed: players.length, linked, created });
}
