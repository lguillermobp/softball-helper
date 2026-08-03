import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ slug: string; seasonId: string }> }

interface SlottedField {
  id: string; name: string;
  slotStartTime: string;
  slotDurationMins: number;
  slots: number[]; // indexed by JS getDay(): [Sun, Mon, Tue, Wed, Thu, Fri, Sat]
}

export interface ProposedGame {
  twinId: string;
  gameNum: 1 | 2;
  date: string;          // "YYYY-MM-DD"
  fieldId: string;
  fieldName: string;
  startTime: string;     // "HH:MM"
  homeTeamId: string;
  homeTeamName: string;
  awayTeamId: string;
  awayTeamName: string;
  categoryId: string | null;   // division these teams play in this season
}

export interface GenerateResult {
  games: ProposedGame[];
  teamSummary: { teamId: string; teamName: string; games: number; twins: number }[];
  pairSummary: { key: string; teamA: string; teamB: string; twins: number }[];
  totalSlots: number;
  scheduledSlots: number;
  warnings: string[];
}

function formatMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function pairKey(a: string, b: string) {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

export async function POST(req: NextRequest, { params }: Params) {
  const { slug, seasonId } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id!;
  const isMasterAdmin = (session.user as any).isMasterAdmin as boolean;

  const league = await prisma.league.findUnique({
    where: { slug },
    include: { userRoles: { where: { userId } } },
  });
  if (!league) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = isMasterAdmin || league.userRoles.some(r => r.role === "LEAGUE_ADMIN");
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (league.status === "SUSPENDED") return NextResponse.json({ error: "This league is currently suspended." }, { status: 423 });

  const season = await prisma.season.findFirst({ where: { id: seasonId, leagueId: league.id } });
  if (!season) return NextResponse.json({ error: "Season not found" }, { status: 404 });

  const { startDate, endDate } = await req.json();
  const rangeStart = new Date(startDate ?? season.startDate);
  const rangeEnd   = new Date(endDate   ?? season.endDate);
  if (rangeStart > rangeEnd) return NextResponse.json({ error: "Invalid date range" }, { status: 400 });

  // Load teams in season (with their division for this season) and fields in league
  const [rawTeams, rawFields] = await Promise.all([
    prisma.team.findMany({
      where: { seasons: { some: { seasonId } }, leagueId: league.id, isActive: true },
      select: { id: true, name: true, seasons: { where: { seasonId }, select: { categoryId: true } } },
    }),
    prisma.field.findMany({ where: { leagueId: league.id }, orderBy: { name: "asc" } }),
  ]);
  const teams = rawTeams.map((t) => ({ id: t.id, name: t.name, categoryId: t.seasons[0]?.categoryId ?? null }));

  if (teams.length < 2) return NextResponse.json({ error: "Need at least 2 teams in the season" }, { status: 400 });

  // Fields with valid slot config
  const fields: SlottedField[] = rawFields
    .filter(f => f.slotStartTime)
    .map(f => ({
      id: f.id, name: f.name,
      slotStartTime: f.slotStartTime!,
      slotDurationMins: f.slotDurationMins,
      // JS getDay(): 0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat
      slots: [f.slotsSunday, f.slotsMonday, f.slotsTuesday, f.slotsWednesday, f.slotsThursday, f.slotsFriday, f.slotsSaturday],
    }));

  if (fields.length === 0) return NextResponse.json({ error: "No fields have slot configuration. Set a start time on at least one field." }, { status: 400 });

  // Generate unique pairs — only between teams in the same division
  const pairs: [typeof teams[0], typeof teams[0]][] = [];
  for (let i = 0; i < teams.length; i++)
    for (let j = i + 1; j < teams.length; j++)
      if (teams[i].categoryId === teams[j].categoryId)
        pairs.push([teams[i], teams[j]]);

  if (pairs.length === 0)
    return NextResponse.json({ error: "No teams share a division to play each other. Assign teams to the same division." }, { status: 400 });

  // Track counts
  const pairCount = new Map<string, number>();
  const teamCount = new Map<string, number>();
  pairs.forEach(([a, b]) => pairCount.set(pairKey(a.id, b.id), 0));
  teams.forEach(t => teamCount.set(t.id, 0));

  const proposed: ProposedGame[] = [];
  const warnings: string[] = [];
  let totalSlots = 0;
  let scheduledSlots = 0;
  let twinSeq = 0;

  // Walk each day in the range
  const cur = new Date(rangeStart);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(rangeEnd);
  end.setHours(23, 59, 59, 999);

  while (cur <= end) {
    const dayOfWeek = cur.getDay();
    const dateStr = cur.toISOString().slice(0, 10);

    const busyTeams = new Set<string>();

    for (const field of fields) {
      const slotsToday = field.slots[dayOfWeek];
      if (slotsToday === 0) continue;

      const [startH, startM] = field.slotStartTime.split(":").map(Number);
      const baseMinutes = startH * 60 + startM;

      for (let slot = 0; slot < slotsToday; slot++) {
        totalSlots++;

        // Available pairs: neither team is busy today
        const available = pairs.filter(([a, b]) => !busyTeams.has(a.id) && !busyTeams.has(b.id));

        if (available.length === 0) {
          warnings.push(`${dateStr} ${field.name} slot ${slot + 1}: no available teams`);
          continue;
        }

        // Sort: lowest pairCount first, then lowest combined teamCount
        available.sort(([a, b], [c, d]) => {
          const pc = (pairCount.get(pairKey(a.id, b.id)) ?? 0) - (pairCount.get(pairKey(c.id, d.id)) ?? 0);
          if (pc !== 0) return pc;
          return ((teamCount.get(a.id) ?? 0) + (teamCount.get(b.id) ?? 0))
               - ((teamCount.get(c.id) ?? 0) + (teamCount.get(d.id) ?? 0));
        });

        const [teamA, teamB] = available[0];
        const twinId = `twin-${++twinSeq}`;
        const slotStart = baseMinutes + slot * 2 * field.slotDurationMins;

        const divisionId = teamA.categoryId; // same as teamB's (paired within division)
        proposed.push({
          twinId, gameNum: 1, date: dateStr, fieldId: field.id, fieldName: field.name,
          startTime: formatMinutes(slotStart),
          homeTeamId: teamA.id, homeTeamName: teamA.name,
          awayTeamId: teamB.id, awayTeamName: teamB.name,
          categoryId: divisionId,
        });
        proposed.push({
          twinId, gameNum: 2, date: dateStr, fieldId: field.id, fieldName: field.name,
          startTime: formatMinutes(slotStart + field.slotDurationMins),
          homeTeamId: teamB.id, homeTeamName: teamB.name,
          awayTeamId: teamA.id, awayTeamName: teamA.name,
          categoryId: divisionId,
        });

        pairCount.set(pairKey(teamA.id, teamB.id), (pairCount.get(pairKey(teamA.id, teamB.id)) ?? 0) + 1);
        teamCount.set(teamA.id, (teamCount.get(teamA.id) ?? 0) + 2);
        teamCount.set(teamB.id, (teamCount.get(teamB.id) ?? 0) + 2);
        busyTeams.add(teamA.id);
        busyTeams.add(teamB.id);
        scheduledSlots++;
      }
    }

    cur.setDate(cur.getDate() + 1);
  }

  const teamSummary = teams.map(t => ({
    teamId: t.id, teamName: t.name,
    games: teamCount.get(t.id) ?? 0,
    twins: (teamCount.get(t.id) ?? 0) / 2,
  })).sort((a, b) => b.games - a.games);

  const pairSummary = [...pairCount.entries()].map(([key, twins]) => {
    const [aId, bId] = key.split("::");
    return {
      key,
      teamA: teams.find(t => t.id === aId)?.name ?? aId,
      teamB: teams.find(t => t.id === bId)?.name ?? bId,
      twins,
    };
  }).sort((a, b) => b.twins - a.twins);

  return NextResponse.json({ games: proposed, teamSummary, pairSummary, totalSlots, scheduledSlots, warnings } satisfies GenerateResult);
}
