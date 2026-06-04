// ── Official scoring stats ────────────────────────────────────────────────────

export interface OfficialBatterStat {
  playerId: string;
  name: string;
  jerseyNumber: string | null;
  photoUrl: string | null;
  nationality: string | null;
  ab: number;      // at-bats (excludes walks)
  h: number;
  singles: number;
  doubles: number;
  triples: number;
  hr: number;
  bb: number;      // walks
  k: number;       // strikeouts
  ba: string;
  obp: string;     // (H+BB)/(AB+BB)
}

export interface OfficialPitcherStat {
  playerId: string;
  name: string;
  jerseyNumber: string | null;
  outs: number;
  ip: string;      // formatted "X.Y" (full innings + remaining outs)
  h: number;       // hits allowed
  bb: number;      // walks allowed
  k: number;       // strikeouts
}

type RawAtBat = { batterId: string; pitcherId: string; outcome: string };
type PlayerMeta = { id: string; name: string; jerseyNumber: string | null; photoUrl: string | null; nationality: string | null };

function formatIP(outs: number): string {
  return `${Math.floor(outs / 3)}.${outs % 3}`;
}

function formatOBP(h: number, bb: number, ab: number): string {
  const pa = ab + bb;
  if (pa === 0) return "—";
  return ((h + bb) / pa).toFixed(3).replace(/^0/, "");
}

export function computeOfficialBatting(
  atBats: RawAtBat[],
  players: PlayerMeta[],
): OfficialBatterStat[] {
  const meta = new Map(players.map(p => [p.id, p]));
  const acc = new Map<string, OfficialBatterStat>();

  for (const ab of atBats) {
    const p = meta.get(ab.batterId);
    const prev = acc.get(ab.batterId) ?? {
      playerId: ab.batterId,
      name: p?.name ?? "Unknown",
      jerseyNumber: p?.jerseyNumber ?? null,
      photoUrl: p?.photoUrl ?? null,
      nationality: p?.nationality ?? null,
      ab: 0, h: 0, singles: 0, doubles: 0, triples: 0, hr: 0, bb: 0, k: 0, ba: "—", obp: "—",
    };

    const isBB = ab.outcome === "WALK";
    const isK  = ab.outcome === "STRIKEOUT";
    const singles = ab.outcome === "SINGLE"   ? 1 : 0;
    const doubles = ab.outcome === "DOUBLE"   ? 1 : 0;
    const triples = ab.outcome === "TRIPLE"   ? 1 : 0;
    const hr      = ab.outcome === "HOME_RUN" ? 1 : 0;
    const h       = singles + doubles + triples + hr;

    const newAb    = prev.ab + (isBB ? 0 : 1);
    const newH     = prev.h + h;
    const newBB    = prev.bb + (isBB ? 1 : 0);

    acc.set(ab.batterId, {
      ...prev,
      ab: newAb,
      h: newH,
      singles: prev.singles + singles,
      doubles: prev.doubles + doubles,
      triples: prev.triples + triples,
      hr: prev.hr + hr,
      bb: newBB,
      k: prev.k + (isK ? 1 : 0),
      ba:  formatBA(newH, newAb),
      obp: formatOBP(newH, newBB, newAb),
    });
  }

  return Array.from(acc.values())
    .filter(s => s.ab + s.bb > 0)
    .sort((a, b) => b.ab - a.ab || a.name.localeCompare(b.name));
}

export function computeOfficialPitching(
  atBats: RawAtBat[],
  players: PlayerMeta[],
): OfficialPitcherStat[] {
  const meta = new Map(players.map(p => [p.id, p]));
  const acc  = new Map<string, OfficialPitcherStat>();

  for (const ab of atBats) {
    const p = meta.get(ab.pitcherId);
    const prev = acc.get(ab.pitcherId) ?? {
      playerId: ab.pitcherId,
      name: p?.name ?? "Unknown",
      jerseyNumber: p?.jerseyNumber ?? null,
      outs: 0, ip: "0.0", h: 0, bb: 0, k: 0,
    };

    const isOut = ab.outcome === "OUT" || ab.outcome === "STRIKEOUT";
    const isHit = ["SINGLE","DOUBLE","TRIPLE","HOME_RUN"].includes(ab.outcome);
    const newOuts = prev.outs + (isOut ? 1 : 0);

    acc.set(ab.pitcherId, {
      ...prev,
      outs: newOuts,
      ip:   formatIP(newOuts),
      h:    prev.h  + (isHit ? 1 : 0),
      bb:   prev.bb + (ab.outcome === "WALK" ? 1 : 0),
      k:    prev.k  + (ab.outcome === "STRIKEOUT" ? 1 : 0),
    });
  }

  return Array.from(acc.values())
    .filter(s => s.outs > 0)
    .sort((a, b) => b.outs - a.outs || a.name.localeCompare(b.name));
}

// ── Manager scorebook stats ───────────────────────────────────────────────────

type Offense = Record<string, Record<string, string>>;

export interface BatterRow {
  playerId: string;
  battingOrder: number;
  name: string;
  jerseyNumber: string | null;
  photoUrl: string | null;
  nationality: string | null;
}

export interface PlayerStat {
  playerId: string;
  name: string;
  jerseyNumber: string | null;
  photoUrl: string | null;
  nationality: string | null;
  ab: number;
  h: number;
  singles: number;
  doubles: number;
  triples: number;
  hr: number;
  ba: string;
}

function tallyOffense(offense: Offense, battingOrder: number) {
  const results: string[] = [];
  for (const inning of Object.values(offense)) {
    const r = inning[battingOrder] ?? "";
    if (r) results.push(r);
  }
  const ab = results.length;
  const singles = results.filter(r => r === "1B").length;
  const doubles = results.filter(r => r === "2B").length;
  const triples = results.filter(r => r === "3B").length;
  const hr = results.filter(r => r === "HR").length;
  return { ab, h: singles + doubles + triples + hr, singles, doubles, triples, hr };
}

function formatBA(h: number, ab: number): string {
  if (ab === 0) return "—";
  return (h / ab).toFixed(3).replace(/^0/, "");
}

export function computeGameStats(
  offense: Offense | null | undefined,
  batters: BatterRow[],
): PlayerStat[] {
  return batters.map(b => {
    const t = offense ? tallyOffense(offense, b.battingOrder) : { ab: 0, h: 0, singles: 0, doubles: 0, triples: 0, hr: 0 };
    return {
      playerId: b.playerId, name: b.name, jerseyNumber: b.jerseyNumber,
      photoUrl: b.photoUrl, nationality: b.nationality,
      ...t, ba: formatBA(t.h, t.ab),
    };
  });
}

export function computeSeasonStats(
  games: Array<{ lineup: BatterRow[]; offense: Offense | null }>,
): PlayerStat[] {
  const acc = new Map<string, {
    name: string; jerseyNumber: string | null; photoUrl: string | null; nationality: string | null;
    ab: number; h: number; singles: number; doubles: number; triples: number; hr: number;
  }>();

  for (const { lineup, offense } of games) {
    if (!offense) continue;
    for (const b of lineup) {
      const t = tallyOffense(offense, b.battingOrder);
      const prev = acc.get(b.playerId) ?? {
        name: b.name, jerseyNumber: b.jerseyNumber, photoUrl: b.photoUrl, nationality: b.nationality,
        ab: 0, h: 0, singles: 0, doubles: 0, triples: 0, hr: 0,
      };
      acc.set(b.playerId, {
        name: b.name, jerseyNumber: b.jerseyNumber, photoUrl: b.photoUrl ?? prev.photoUrl, nationality: b.nationality ?? prev.nationality,
        ab: prev.ab + t.ab, h: prev.h + t.h,
        singles: prev.singles + t.singles, doubles: prev.doubles + t.doubles,
        triples: prev.triples + t.triples, hr: prev.hr + t.hr,
      });
    }
  }

  return Array.from(acc.entries())
    .map(([playerId, s]) => ({
      playerId, name: s.name, jerseyNumber: s.jerseyNumber, photoUrl: s.photoUrl, nationality: s.nationality,
      ab: s.ab, h: s.h, singles: s.singles, doubles: s.doubles, triples: s.triples, hr: s.hr,
      ba: formatBA(s.h, s.ab),
    }))
    .sort((a, b) => b.ab - a.ab || a.name.localeCompare(b.name));
}
