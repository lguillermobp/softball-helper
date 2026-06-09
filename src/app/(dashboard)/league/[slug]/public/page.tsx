import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

interface PageProps { params: Promise<{ slug: string }> }

type SocialLinks = { instagram?: string; facebook?: string; whatsapp?: string; twitter?: string };

interface StandingRow {
  name: string; logoUrl: string | null; rank: number;
  gp: number; w: number; l: number; t: number;
  pts: number; rf: number; ra: number; pct: string;
}

interface GroupBlock { group: string | null; rows: StandingRow[] }

interface UpcomingGame {
  id: string; scheduledAt: string; seasonId: string;
  homeTeam: string; awayTeam: string;
  homeLogoUrl: string | null; awayLogoUrl: string | null;
  fieldName: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function tbv(rf: number, ra: number, w: number, key: string): number {
  if (key === "RD") return rf - ra;
  if (key === "RF") return rf;
  if (key === "RA") return -ra;
  if (key === "W")  return w;
  return 0;
}

const DAYS   = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"] as const;

// ── Sub-components ─────────────────────────────────────────────────────────────

function TeamLogo({ name, logoUrl, size = 28 }: { name: string; logoUrl: string | null; size?: number }) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoUrl} alt={name} style={{ width: size, height: size, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />;
  }
  return (
    <div style={{ width: size, height: size, borderRadius: 6, background: "#14532d", display: "flex", alignItems: "center", justifyContent: "center", color: "#4ade80", fontWeight: 700, fontSize: Math.round(size * 0.43), flexShrink: 0 }}>
      {name.charAt(0)}
    </div>
  );
}

function GroupTable({ block, showPct }: { block: GroupBlock; showPct: boolean }) {
  const cols = ["#", "Team", "GP", "W", "L", "T", "Pts", ...(showPct ? ["PCT"] : [])];
  return (
    <div>
      {block.group && (
        <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#4ade80", margin: "0 0 8px", opacity: 0.8 }}>
          Group {block.group}
        </p>
      )}
      <div style={{ border: "1px solid #1a3a1a", borderRadius: 12, overflow: "hidden", background: "#0d1a0d" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #1a3a1a" }}>
              {cols.map(h => (
                <th key={h} style={{ padding: "9px 10px", color: "#4ade80", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: h === "Team" ? "left" : "center" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((s, i) => (
              <tr key={s.name} style={{ borderBottom: i < block.rows.length - 1 ? "1px solid #111c11" : "none" }}>
                <td style={{ padding: "9px 10px", textAlign: "center", color: s.rank === 1 ? "#fbbf24" : "#4ade80", fontWeight: 700, fontSize: 12 }}>{s.rank}</td>
                <td style={{ padding: "9px 10px", color: "#f0fdf4", fontWeight: 600, maxWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <TeamLogo name={s.name} logoUrl={s.logoUrl} size={24} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                  </div>
                </td>
                <td style={{ padding: "9px 10px", textAlign: "center", color: "#86efac" }}>{s.gp}</td>
                <td style={{ padding: "9px 10px", textAlign: "center", color: "#4ade80", fontWeight: 700 }}>{s.w}</td>
                <td style={{ padding: "9px 10px", textAlign: "center", color: "#f87171" }}>{s.l}</td>
                <td style={{ padding: "9px 10px", textAlign: "center", color: "#86efac" }}>{s.t}</td>
                <td style={{ padding: "9px 10px", textAlign: "center", color: "#f0fdf4", fontWeight: 700 }}>{s.pts}</td>
                {showPct && (
                  <td style={{ padding: "9px 10px", textAlign: "center", color: "#86efac", fontSize: 12 }}>{s.pct}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GameCard({ game }: { game: UpcomingGame }) {
  const d = new Date(game.scheduledAt);
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div style={{ display: "flex", alignItems: "stretch", borderRadius: 12, border: "1px solid #1a3a1a", background: "#0d1a0d", overflow: "hidden" }}>
      {/* Date block */}
      <div style={{ padding: "12px 14px", background: "#111c11", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minWidth: 64, flexShrink: 0, gap: 2 }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#4ade80" }}>
          {DAYS[d.getDay()]}
        </span>
        <span style={{ fontSize: 22, fontWeight: 800, color: "#f0fdf4", lineHeight: 1 }}>
          {d.getDate()}
        </span>
        <span style={{ fontSize: 10, textTransform: "uppercase", color: "#86efac" }}>
          {MONTHS[d.getMonth()]}
        </span>
      </div>

      {/* Matchup */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "12px 16px", minWidth: 0 }}>
        {/* Home */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, justifyContent: "flex-end", overflow: "hidden" }}>
          <span style={{ color: "#f0fdf4", fontWeight: 600, fontSize: 14, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {game.homeTeam}
          </span>
          <TeamLogo name={game.homeTeam} logoUrl={game.homeLogoUrl} size={30} />
        </div>

        <span style={{ fontSize: 10, fontWeight: 800, color: "#4ade80", letterSpacing: "0.1em", flexShrink: 0, padding: "0 4px" }}>VS</span>

        {/* Away */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, overflow: "hidden" }}>
          <TeamLogo name={game.awayTeam} logoUrl={game.awayLogoUrl} size={30} />
          <span style={{ color: "#f0fdf4", fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {game.awayTeam}
          </span>
        </div>
      </div>

      {/* Time + field */}
      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "center", flexShrink: 0, gap: 3, minWidth: 70 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#86efac" }}>{time}</span>
        {game.fieldName && (
          <span style={{ fontSize: 11, color: "#4ade80", opacity: 0.65, maxWidth: 110, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            📍 {game.fieldName}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function LeaguePublicPage({ params }: PageProps) {
  const { slug } = await params;

  const league = await prisma.league.findUnique({
    where: { slug },
    include: {
      publicPage: true,
      teams: {
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, logoUrl: true },
      },
      seasons: {
        orderBy: { startDate: "desc" },
        take: 1,
        select: {
          id: true, name: true,
          pointsWin: true, pointsTie: true, pointsLoss: true,
          showPct: true, tiebreakers: true,
        },
      },
    },
  });

  if (!league || !league.publicPage?.published) notFound();

  const cfg = league.publicPage;
  const social = (cfg.socialLinks ?? {}) as SocialLinks;
  const hasSocial = Object.values(social).some(Boolean);
  const latestSeason = league.seasons[0] ?? null;

  // ── Standings ──────────────────────────────────────────────────────────────
  let groupedStandings: GroupBlock[] = [];
  let showPct = true;

  if (cfg.showStandings && latestSeason) {
    const ptsWin  = latestSeason.pointsWin;
    const ptsTie  = latestSeason.pointsTie;
    const ptsLoss = latestSeason.pointsLoss;
    showPct       = latestSeason.showPct;
    const tbs     = latestSeason.tiebreakers.split(",").filter(Boolean);

    const [seasonTeams, completedGames] = await Promise.all([
      prisma.team.findMany({
        where: { seasonId: latestSeason.id, isActive: true },
        select: { id: true, name: true, logoUrl: true, group: true },
        orderBy: { name: "asc" },
      }),
      prisma.game.findMany({
        where: { seasonId: latestSeason.id, status: "COMPLETED" },
        select: { homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true },
      }),
    ]);

    type StatEntry = {
      name: string; logoUrl: string | null; group: string | null;
      gp: number; w: number; l: number; t: number; pts: number; rf: number; ra: number;
    };
    const statsMap = new Map<string, StatEntry>();
    for (const t of seasonTeams) {
      statsMap.set(t.id, { name: t.name, logoUrl: t.logoUrl ?? null, group: t.group ?? null, gp: 0, w: 0, l: 0, t: 0, pts: 0, rf: 0, ra: 0 });
    }
    for (const g of completedGames) {
      const hs = g.homeScore ?? 0, as_ = g.awayScore ?? 0;
      const home = statsMap.get(g.homeTeamId);
      const away = statsMap.get(g.awayTeamId);
      if (!home || !away) continue;
      home.gp++; away.gp++;
      home.rf += hs; home.ra += as_;
      away.rf += as_; away.ra += hs;
      if (hs > as_)       { home.w++; home.pts += ptsWin; away.l++; away.pts += ptsLoss; }
      else if (as_ > hs)  { away.w++; away.pts += ptsWin; home.l++; home.pts += ptsLoss; }
      else                { home.t++; home.pts += ptsTie; away.t++; away.pts += ptsTie; }
    }

    // Sort globally, then split by group (keeps intra-group order correct)
    const sorted = [...statsMap.values()].sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      for (const tb of tbs) {
        const diff = tbv(b.rf, b.ra, b.w, tb) - tbv(a.rf, a.ra, a.w, tb);
        if (diff !== 0) return diff;
      }
      return a.name.localeCompare(b.name);
    });

    // Build StandingRow with equal-rank (1,2,2,4 style)
    const groupMap = new Map<string, StandingRow[]>();
    for (let i = 0; i < sorted.length; i++) {
      const s = sorted[i];
      let rank = i + 1;
      for (let j = i - 1; j >= 0; j--) {
        const prev = sorted[j];
        if (prev.pts !== s.pts) break;
        if (tbs.every(tb => tbv(prev.rf, prev.ra, prev.w, tb) === tbv(s.rf, s.ra, s.w, tb))) rank = j + 1;
        else break;
      }
      const row: StandingRow = {
        ...s, rank,
        pct: s.gp > 0 ? (s.w / s.gp).toFixed(3).replace(/^0/, "") : ".000",
      };
      const key = s.group ?? "";
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(row);
    }

    // Sort group keys: named groups alphabetically, ungrouped ("") last
    const sortedKeys = [...groupMap.keys()].sort((a, b) => {
      if (!a && b) return 1;
      if (a && !b) return -1;
      return a.localeCompare(b);
    });
    groupedStandings = sortedKeys.map(key => ({ group: key || null, rows: groupMap.get(key)! }));
  }

  // ── Upcoming Games ─────────────────────────────────────────────────────────
  let upcoming: UpcomingGame[] = [];
  if (cfg.showSchedule) {
    const games = await prisma.game.findMany({
      where: { leagueId: league.id, status: { in: ["SCHEDULED", "IN_PROGRESS"] }, scheduledAt: { gte: new Date() } },
      orderBy: { scheduledAt: "asc" },
      take: 10,
      select: {
        id: true, scheduledAt: true, seasonId: true,
        homeTeam: { select: { name: true, logoUrl: true } },
        awayTeam: { select: { name: true, logoUrl: true } },
        field:    { select: { name: true } },
      },
    });
    upcoming = games.map(g => ({
      id: g.id, scheduledAt: g.scheduledAt.toISOString(), seasonId: g.seasonId,
      homeTeam: g.homeTeam.name, awayTeam: g.awayTeam.name,
      homeLogoUrl: g.homeTeam.logoUrl ?? null,
      awayLogoUrl: g.awayTeam.logoUrl ?? null,
      fieldName: g.field?.name ?? null,
    }));
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const logoUrl = league.logoUrl;
  const hasGroups = groupedStandings.length > 1;
  const half = Math.ceil(groupedStandings.length / 2);
  const leftCol  = groupedStandings.slice(0, half);
  const rightCol = groupedStandings.slice(half);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f0a", color: "#f0fdf4", fontFamily: "sans-serif" }}>
      {/* Responsive grid for multi-group standings */}
      <style>{`
        .pub-sg { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }
        @media (max-width: 640px) { .pub-sg { grid-template-columns: 1fr; } }
      `}</style>

      {/* Hero */}
      <div style={{ position: "relative", overflow: "hidden", minHeight: 260, display: "flex", alignItems: "flex-end" }}>
        {logoUrl && (
          <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${logoUrl})`, backgroundSize: "cover", backgroundPosition: "center", filter: "blur(50px)", transform: "scale(1.3)", opacity: 0.25 }} />
        )}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(10,15,10,0.95) 100%)" }} />
        <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 960, margin: "0 auto", padding: "40px 24px 32px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={league.name} style={{ width: 80, height: 80, borderRadius: 16, objectFit: "cover", border: "2px solid rgba(74,222,128,0.3)" }} />
            )}
            <div>
              <h1 style={{ fontSize: 32, fontWeight: 800, color: "#f0fdf4", margin: 0 }}>{league.name}</h1>
              {(league.city || league.state) && (
                <p style={{ color: "#86efac", fontSize: 14, margin: "4px 0 0" }}>📍 {[league.city, league.state].filter(Boolean).join(", ")}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px", display: "flex", flexDirection: "column", gap: 32 }}>

        {/* Description */}
        {cfg.description && (
          <p style={{ color: "#86efac", fontSize: 15, lineHeight: 1.7, maxWidth: 700, margin: 0 }}>{cfg.description}</p>
        )}

        {/* Social */}
        {hasSocial && (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {social.instagram && <a href={social.instagram} target="_blank" rel="noreferrer" style={socialBtn}>📸 Instagram</a>}
            {social.facebook  && <a href={social.facebook}  target="_blank" rel="noreferrer" style={socialBtn}>📘 Facebook</a>}
            {social.whatsapp  && <a href={social.whatsapp}  target="_blank" rel="noreferrer" style={socialBtn}>💬 WhatsApp</a>}
            {social.twitter   && <a href={social.twitter}   target="_blank" rel="noreferrer" style={socialBtn}>𝕏 Twitter</a>}
          </div>
        )}

        {/* Standings */}
        {cfg.showStandings && groupedStandings.length > 0 && (
          <section>
            <h2 style={sectionTitle}>🏆 Standings{latestSeason ? ` — ${latestSeason.name}` : ""}</h2>
            {hasGroups ? (
              <div className="pub-sg">
                {/* Left column: first half of groups (A, B with 4 groups → A|C, B|D layout) */}
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  {leftCol.map(g => <GroupTable key={g.group ?? "l"} block={g} showPct={showPct} />)}
                </div>
                {/* Right column: second half of groups */}
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  {rightCol.map(g => <GroupTable key={g.group ?? "r"} block={g} showPct={showPct} />)}
                </div>
              </div>
            ) : (
              <GroupTable block={groupedStandings[0]} showPct={showPct} />
            )}
          </section>
        )}

        {/* Upcoming Games */}
        {cfg.showSchedule && upcoming.length > 0 && (
          <section>
            <h2 style={sectionTitle}>📅 Upcoming Games</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {upcoming.map(g => <GameCard key={g.id} game={g} />)}
            </div>
          </section>
        )}

        {/* Teams */}
        {cfg.showTeams && league.teams.length > 0 && (
          <section>
            <h2 style={sectionTitle}>👥 Teams</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {league.teams.map(t => (
                <Link key={t.id} href={`/league/${slug}/team/${t.id}/public`}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderRadius: 12, border: "1px solid #1a3a1a", background: "#0d1a0d", textDecoration: "none" }}>
                  {t.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.logoUrl} alt={t.name} style={{ width: 32, height: 32, borderRadius: 8, objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: "#14532d", display: "flex", alignItems: "center", justifyContent: "center", color: "#4ade80", fontWeight: 700, fontSize: 14 }}>
                      {t.name.charAt(0)}
                    </div>
                  )}
                  <span style={{ color: "#f0fdf4", fontWeight: 600, fontSize: 14 }}>{t.name}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <footer style={{ borderTop: "1px solid #1a3a1a", paddingTop: 20, color: "#4ade80", fontSize: 12, opacity: 0.5, textAlign: "center" }}>
          Powered by Softball Helper
        </footer>
      </div>
    </div>
  );
}

const sectionTitle = { fontSize: 18, fontWeight: 700, color: "#4ade80", margin: "0 0 16px 0" };
const socialBtn    = { display: "inline-block", padding: "8px 16px", borderRadius: 8, border: "1px solid #1a3a1a", background: "#0d1a0d", color: "#4ade80", textDecoration: "none", fontSize: 13, fontWeight: 600 };
