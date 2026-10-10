import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadOwnedClub } from "@/lib/club";

interface Params { params: Promise<{ clubId: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { clubId } = await params;
  const club = await loadOwnedClub(clubId, me.id, !!me.isMasterAdmin);
  if (!club) return NextResponse.json({ error: "Club not found" }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  const action = b.action;

  // Mark two profiles as different people, so they stop being suggested.
  if (action === "keep-separate") {
    if (!b.aId || !b.bId || b.aId === b.bId) return NextResponse.json({ error: "Two distinct profiles are required." }, { status: 400 });
    const [profile1, profile2] = [b.aId, b.bId].sort();
    await prisma.distinctPair.upsert({
      where: { clubId_profile1_profile2: { clubId, profile1, profile2 } },
      update: {}, create: { clubId, profile1, profile2 },
    });
    return NextResponse.json({ success: true });
  }

  // Fold `mergedId` into `survivorId` (reversible).
  if (action === "merge") {
    const { survivorId, mergedId } = b;
    if (!survivorId || !mergedId || survivorId === mergedId) return NextResponse.json({ error: "Pick two different profiles to merge." }, { status: 400 });
    const [survivor, merged] = await Promise.all([
      prisma.playerProfile.findFirst({ where: { id: survivorId, clubId }, select: { id: true, dob: true, emails: true } }),
      prisma.playerProfile.findFirst({ where: { id: mergedId, clubId }, select: { id: true, name: true, dob: true, emails: true, players: { select: { id: true } } } }),
    ]);
    if (!survivor || !merged) return NextResponse.json({ error: "Profile not found." }, { status: 404 });

    const addedEmails = merged.emails.filter((e) => !survivor.emails.includes(e));
    const setDob = !survivor.dob && !!merged.dob;
    const movedPlayerIds = merged.players.map((p) => p.id);

    await prisma.$transaction([
      prisma.profileMerge.create({
        data: { clubId, survivorId, mergedName: merged.name, mergedDob: merged.dob, mergedEmails: merged.emails, movedPlayerIds, addedEmails, setDob },
      }),
      prisma.player.updateMany({ where: { profileId: mergedId }, data: { profileId: survivorId } }),
      prisma.playerProfile.update({
        where: { id: survivorId },
        data: { ...(addedEmails.length ? { emails: { push: addedEmails } } : {}), ...(setDob ? { dob: merged.dob } : {}) },
      }),
      prisma.distinctPair.deleteMany({ where: { clubId, OR: [{ profile1: mergedId }, { profile2: mergedId }] } }),
      prisma.playerProfile.delete({ where: { id: mergedId } }),
    ]);
    return NextResponse.json({ success: true });
  }

  // Undo a merge: recreate the merged profile, restore its players, un-enrich the survivor.
  if (action === "unmerge") {
    const m = await prisma.profileMerge.findFirst({ where: { id: b.mergeId, clubId, undone: false } });
    if (!m) return NextResponse.json({ error: "Merge not found." }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      const restored = await tx.playerProfile.create({
        data: { clubId, name: m.mergedName, dob: m.mergedDob, emails: m.mergedEmails },
        select: { id: true },
      });
      await tx.player.updateMany({ where: { id: { in: m.movedPlayerIds } }, data: { profileId: restored.id } });

      const surv = await tx.playerProfile.findUnique({ where: { id: m.survivorId }, select: { emails: true } });
      if (surv) {
        await tx.playerProfile.update({
          where: { id: m.survivorId },
          data: { emails: { set: surv.emails.filter((e) => !m.addedEmails.includes(e)) }, ...(m.setDob ? { dob: null } : {}) },
        });
        // They were just told apart — don't immediately re-suggest them.
        const [p1, p2] = [m.survivorId, restored.id].sort();
        await tx.distinctPair.upsert({
          where: { clubId_profile1_profile2: { clubId, profile1: p1, profile2: p2 } },
          update: {}, create: { clubId, profile1: p1, profile2: p2 },
        });
      }
      await tx.profileMerge.update({ where: { id: m.id }, data: { undone: true } });
    });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
