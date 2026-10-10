import { prisma } from "@/lib/prisma";

/** Load a club only if the user owns it (or is a master admin). Returns null otherwise. */
export async function loadOwnedClub(clubId: string, userId: string, isMasterAdmin: boolean) {
  const club = await prisma.club.findUnique({
    where: { id: clubId },
    select: { id: true, name: true, slug: true, ownerId: true },
  });
  if (!club) return null;
  if (!isMasterAdmin && club.ownerId !== userId) return null;
  return club;
}
