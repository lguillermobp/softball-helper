/** Phase 2 identity matching — email (set) + name + DOB, precision over recall. */

export function normName(name: string | null | undefined): string {
  return (name ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // strip accents
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function normEmail(email: string | null | undefined): string | null {
  const e = (email ?? "").trim().toLowerCase();
  return e || null;
}

function dobKey(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 10);
}

/** Both present and different → strong evidence they are NOT the same person. */
export function dobConflict(a: Date | string | null | undefined, b: Date | string | null | undefined): boolean {
  const ka = dobKey(a), kb = dobKey(b);
  return !!ka && !!kb && ka !== kb;
}

function dobMatch(a: Date | string | null | undefined, b: Date | string | null | undefined): boolean {
  const ka = dobKey(a), kb = dobKey(b);
  return !!ka && !!kb && ka === kb;
}

export interface ProfileLike { id: string; name: string; dob: Date | null; emails: string[] }
export interface PlayerLike { name: string; email: string | null; dob: Date | null }

/**
 * Auto-link target for a player among the club's profiles, or null to create a new one.
 * Auto-link only on strong, unambiguous evidence: (shared email + name) or (name + DOB).
 * A DOB conflict disqualifies a candidate outright.
 */
export function matchPlayer(p: PlayerLike, profiles: ProfileLike[]): string | null {
  const nn = normName(p.name);
  const pe = normEmail(p.email);
  for (const prof of profiles) {
    if (dobConflict(p.dob, prof.dob)) continue;
    const nameMatch = normName(prof.name) === nn && nn.length > 0;
    const emailMatch = !!pe && prof.emails.includes(pe);
    if ((emailMatch && nameMatch) || (nameMatch && dobMatch(p.dob, prof.dob))) return prof.id;
  }
  return null;
}

/** Should two existing profiles be SUGGESTED as possible duplicates (same name, DOBs not conflicting)? */
export function suggestDuplicate(a: ProfileLike, b: ProfileLike): boolean {
  const na = normName(a.name);
  if (!na || na !== normName(b.name)) return false;
  return !dobConflict(a.dob, b.dob);
}
