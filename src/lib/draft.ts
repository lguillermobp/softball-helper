import { prisma } from "@/lib/prisma";
import { canAdminCategory } from "@/lib/tryout";

/**
 * The order teams pick in, expanded to one entry per draft slot.
 * Snake reverses the lottery order every other round. Keepers already on a team
 * count toward the target, so teams with keepers reach the target sooner and draft
 * fewer players. Once every team is at target, any leftover prospects are dealt out
 * in further rounds (extras land on the earliest picks).
 */
export function computeDraftOrder(
  pickOrder: string[],
  snake: boolean,
  keeperCounts: Record<string, number>,
  target: number,
  totalToDraft: number,
): string[] {
  const roster: Record<string, number> = {};
  for (const id of pickOrder) roster[id] = keeperCounts[id] ?? 0;
  const order: string[] = [];
  let round = 0;

  // Phase 1 — fill each team up to the target.
  while (order.length < totalToDraft) {
    const teams = snake && round % 2 === 1 ? [...pickOrder].reverse() : pickOrder;
    let placed = false;
    for (const id of teams) {
      if (order.length >= totalToDraft) break;
      if (roster[id] < target) { order.push(id); roster[id]++; placed = true; }
    }
    round++;
    if (!placed) break; // everyone at target — leftovers handled below
  }
  // Phase 2 — extras beyond target go to the earliest picks first (always forward order).
  while (order.length < totalToDraft) {
    for (const id of pickOrder) {
      if (order.length >= totalToDraft) break;
      order.push(id);
    }
  }
  return order;
}

export interface Tier { label: string; min: number; max: number }

/** 1.0-wide score tiers from the rating scale, highest first (e.g. 4.0–5.0, 3.0–3.99). */
export function scoreTiers(ratingMin: number, ratingMax: number): Tier[] {
  const tiers: Tier[] = [];
  for (let lo = ratingMax - 1; lo >= ratingMin; lo--) {
    const isTop = lo === ratingMax - 1;
    tiers.push({ label: `${lo.toFixed(1)}–${isTop ? ratingMax.toFixed(1) : (lo + 0.99).toFixed(2)}`, min: lo, max: isTop ? ratingMax : lo + 0.999 });
  }
  return tiers;
}

export function tierIndexFor(score: number | null, tiers: Tier[]): number {
  if (score == null) return tiers.length; // "unrated" bucket after the last tier
  for (let i = 0; i < tiers.length; i++) if (score >= tiers[i].min && score <= tiers[i].max) return i;
  return tiers.length;
}

/** Load a draft and confirm the user administers its category. */
export async function loadDraftForAdmin(slug: string, draftId: string, userId: string, isMasterAdmin: boolean) {
  const league = await prisma.league.findUnique({ where: { slug }, select: { id: true, status: true } });
  if (!league) return { error: "Not found" as const, status: 404 };
  const draft = await prisma.draft.findFirst({
    where: { id: draftId, season: { leagueId: league.id } },
    select: { id: true, seasonId: true, categoryId: true, status: true, snake: true, targetPerTeam: true, pickOrder: true, currentPick: true },
  });
  if (!draft) return { error: "Draft not found" as const, status: 404 };
  if (!(await canAdminCategory(userId, isMasterAdmin, draft.categoryId)))
    return { error: "Forbidden" as const, status: 403 };
  return { league, draft };
}
