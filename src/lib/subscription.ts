import { prisma } from "@/lib/prisma";

export type SubStatus = "ACTIVE" | "EXPIRED" | "LIMIT_REACHED" | "NO_SUBSCRIPTION";

export interface SubscriptionInfo {
  effectiveStatus: SubStatus;
  subscription: {
    id: string;
    maxGames: number;
    startDate: Date;
    endDate: Date;
    stripeSubscriptionId: string | null;
    plan: { id: string; name: string; price: number };
  } | null;
  gamesUsed: number;
  daysRemaining: number;
}

export async function getLeagueSubscriptionInfo(leagueId: string): Promise<SubscriptionInfo> {
  const now = new Date();

  const subscription = await prisma.leagueSubscription.findFirst({
    where: { leagueId, status: "ACTIVE" },
    include: { plan: { select: { id: true, name: true, price: true } } },
    orderBy: { startDate: "desc" },
  });

  if (!subscription) {
    return { effectiveStatus: "NO_SUBSCRIPTION", subscription: null, gamesUsed: 0, daysRemaining: 0 };
  }

  const gamesUsed = await prisma.game.count({
    where: {
      leagueId,
      status: { notIn: ["CANCELLED", "RESCHEDULED"] },
      createdAt: { gte: subscription.startDate },
    },
  });

  const isExpired      = subscription.endDate < now;
  const isLimitReached = gamesUsed >= subscription.maxGames;

  let effectiveStatus: SubStatus;
  if (isExpired)           effectiveStatus = "EXPIRED";
  else if (isLimitReached) effectiveStatus = "LIMIT_REACHED";
  else                     effectiveStatus = "ACTIVE";

  const daysRemaining = isExpired
    ? 0
    : Math.ceil((subscription.endDate.getTime() - now.getTime()) / 86_400_000);

  return { effectiveStatus, subscription, gamesUsed, daysRemaining };
}
