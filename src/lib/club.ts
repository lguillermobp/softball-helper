import { prisma } from "@/lib/prisma";

/** Load a club only if the user owns it (or is a master admin). Returns null otherwise. */
export async function loadOwnedClub(clubId: string, userId: string, isMasterAdmin: boolean) {
  const club = await prisma.club.findUnique({
    where: { id: clubId },
    select: { id: true, name: true, slug: true, subdomain: true, ownerId: true },
  });
  if (!club) return null;
  if (!isMasterAdmin && club.ownerId !== userId) return null;
  return club;
}

export interface ClubBillingLike {
  subscriptionStatus: string | null;
  plan: { name: string; allowSubdomain: boolean; allowAnalytics: boolean; maxTeams: number | null } | null;
}

/** Perks a club has, from its plan + a healthy (active) subscription. Free gets nothing premium. */
export function clubEntitlements(c: ClubBillingLike) {
  const active = c.subscriptionStatus === "active" && !!c.plan;
  return {
    planName: c.plan?.name ?? "Free",
    status: c.subscriptionStatus ?? null,
    subdomain: active ? c.plan!.allowSubdomain : false,
    analytics: active ? c.plan!.allowAnalytics : false,
  };
}
