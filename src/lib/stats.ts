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
