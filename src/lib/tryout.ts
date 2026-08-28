import { prisma } from "@/lib/prisma";

/**
 * Tryout & Draft access + age helpers.
 * The whole module is only meaningful when a league has `usesTryoutDraft = true`.
 */

/** Is the tryout/draft module enabled for this league? */
export async function leagueUsesTryoutDraft(leagueId: string): Promise<boolean> {
  const l = await prisma.league.findUnique({ where: { id: leagueId }, select: { usesTryoutDraft: true } });
  return !!l?.usesTryoutDraft;
}

/**
 * Can this user administer a category (register prospects, run its tryouts & draft)?
 * True for a master admin, a LEAGUE_ADMIN of the category's league, or an assigned category admin.
 */
export async function canAdminCategory(userId: string, isMasterAdmin: boolean, categoryId: string): Promise<boolean> {
  if (isMasterAdmin) return true;
  const cat = await prisma.category.findUnique({
    where: { id: categoryId },
    select: {
      league: { select: { userRoles: { where: { userId, role: "LEAGUE_ADMIN" }, select: { id: true } } } },
      admins: { where: { userId }, select: { id: true } },
    },
  });
  if (!cat) return false;
  return cat.league.userRoles.length > 0 || cat.admins.length > 0;
}

/** Categories a user may administer within a league (all of them for league/master admins). */
export async function adminCategoryIds(userId: string, isMasterAdmin: boolean, leagueId: string): Promise<string[] | "ALL"> {
  if (isMasterAdmin) return "ALL";
  const isLeagueAdmin = await prisma.userLeagueRole.findFirst({
    where: { userId, leagueId, role: "LEAGUE_ADMIN" }, select: { id: true },
  });
  if (isLeagueAdmin) return "ALL";
  const rows = await prisma.categoryAdmin.findMany({
    where: { userId, category: { leagueId } }, select: { categoryId: true },
  });
  return rows.map((r) => r.categoryId);
}

/** Whole-year age on a fixed cutoff date (e.g. "age as of Dec 31"). */
export function ageOnDate(dob: Date, cutoff: Date): number {
  let age = cutoff.getFullYear() - dob.getFullYear();
  const m = cutoff.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && cutoff.getDate() < dob.getDate())) age--;
  return age;
}

interface AgedCategory { id: string; name: string; minAge: number | null; maxAge: number | null }

/**
 * Suggest the category whose [minAge, maxAge] contains the prospect's age on the cutoff.
 * Returns the single match, or null when there is no unambiguous fit (none, or an overlap).
 */
export function suggestCategory(dob: Date, cutoff: Date, categories: AgedCategory[]): string | null {
  const age = ageOnDate(dob, cutoff);
  const fits = categories.filter(
    (c) => c.minAge != null && c.maxAge != null && age >= c.minAge && age <= c.maxAge,
  );
  return fits.length === 1 ? fits[0].id : null;
}
