import type React from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ScheduleSection } from "@/components/public/ScheduleSection";
import { PublicPageWrapper } from "@/components/public/PublicPageWrapper";
import type { UpcomingGame, PastGame, SeasonTeam } from "@/components/public/ScheduleSection";

interface PageProps { params: Promise<{ slug: string }> }

type SocialLinks = { instagram?: string; facebook?: string; whatsapp?: string; twitter?: string };

interface StandingRow {
  id: string; name: string; logoUrl: string | null; rank: number;
  gp: number; w: number; l: number; t: number;
  pts: number; rf: number; ra: number; pct: string;
}

interface GroupBlock { group: string | null; rows: StandingRow[] }

// ── Helpers ────────────────────────────────────────────────────────────────────

function tbv(rf: number, ra: number, w: number, key: string): number {
  if (key === "RD") return rf - ra;
  if (key === "RF") return rf;
  if (key === "RA") return -ra;
  if (key === "W")  return w;
  return 0;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function TeamLogo({ name, logoUrl, size = 24 }: { name: string; logoUrl: string | null; size?: number }) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoUrl} alt={name} style={{ width: size, height: size, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />;
  }
  return (
    <div style={{ width: size, height: size, borderRadius: 6, background: "var(--pub-logo-bg)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--pub-accent)", fontWeight: 700, fontSize: Math.round(size * 0.43), flexShrink: 0 }}>
      {name.charAt(0)}
    </div>
  );
}

function GroupTable({ block, showPct, slug }: { block: GroupBlock; showPct: boolean; slug: string }) {
  const cols = ["#", "Team", "GP", "W", "L", "T", "Pts", "RF", "RA", "RD", ...(showPct ? ["PCT"] : [])];
  return (
    <div>
      {block.group && (
        <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--pub-accent)", margin: "0 0 10px", opacity: 0.8 }}>
          Group {block.group}
        </p>
      )}
      <div style={{ border: "1px solid var(--pub-border)", borderRadius: 12, overflow: "hidden", background: "var(--pub-bg-card)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--pub-border)" }}>
              {cols.map(h => (
                <th key={h} style={{ padding: "10px 10px", color: "var(--pub-accent)", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: h === "Team" ? "left" : "center" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((s, i) => {
              const rd = s.rf - s.ra;
              const rdColor = rd > 0 ? "var(--pub-accent)" : rd < 0 ? "var(--pub-danger)" : "var(--pub-text2)";
              const rdText  = rd > 0 ? `+${rd}` : String(rd);
              return (
                <tr key={s.name} style={{ borderBottom: i < block.rows.length - 1 ? "1px solid var(--pub-border2)" : "none", background: s.rank === 1 ? "var(--pub-accent-subtle)" : "transparent" }}>
                  <td style={{ padding: "10px 10px", textAlign: "center", color: s.rank === 1 ? "var(--pub-gold)" : "var(--pub-accent)", fontWeight: 700, fontSize: 13 }}>{s.rank}</td>
                  <td style={{ padding: "10px 10px", color: "var(--pub-text)", fontWeight: 600 }}>
                    <Link href={`/league/${slug}/team/${s.id}/public`} style={{ display: "flex", alignItems: "center", gap: 8, color: "inherit", textDecoration: "none" }}>
                      <TeamLogo name={s.name} logoUrl={s.logoUrl} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                    </Link>
                  </td>
                  <td style={{ padding: "10px 10px", textAlign: "center", color: "var(--pub-text2)" }}>{s.gp}</td>
                  <td style={{ padding: "10px 10px", textAlign: "center", color: "var(--pub-accent)", fontWeight: 700 }}>{s.w}</td>
                  <td style={{ padding: "10px 10px", textAlign: "center", color: "var(--pub-danger)" }}>{s.l}</td>
                  <td style={{ padding: "10px 10px", textAlign: "center", color: "var(--pub-text2)" }}>{s.t}</td>
                  <td style={{ padding: "10px 10px", textAlign: "center", color: "var(--pub-text)", fontWeight: 700 }}>{s.pts}</td>
                  <td style={{ padding: "10px 10px", textAlign: "center", color: "var(--pub-text2)" }}>{s.rf}</td>
                  <td style={{ padding: "10px 10px", textAlign: "center", color: "var(--pub-text2)" }}>{s.ra}</td>
                  <td style={{ padding: "10px 10px", textAlign: "center", color: rdColor, fontWeight: 600 }}>{rdText}</td>
                  {showPct && <td style={{ padding: "10px 10px", textAlign: "center", color: "var(--pub-text2)", fontSize: 13 }}>{s.pct}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
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
        where: { seasonId: latestSeason.id, status: "COMPLETED", isPractice: false },
        select: { homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true },
      }),
    ]);

    type StatEntry = {
      id: string; name: string; logoUrl: string | null; group: string | null;
      gp: number; w: number; l: number; t: number; pts: number; rf: number; ra: number;
    };

    // Accumulate stats
    const statsMap = new Map<string, StatEntry>();
    for (const t of seasonTeams) {
      statsMap.set(t.id, { id: t.id, name: t.name, logoUrl: t.logoUrl ?? null, group: t.group ?? null, gp: 0, w: 0, l: 0, t: 0, pts: 0, rf: 0, ra: 0 });
    }
    for (const g of completedGames) {
      const hs = g.homeScore ?? 0, as_ = g.awayScore ?? 0;
      const home = statsMap.get(g.homeTeamId);
      const away = statsMap.get(g.awayTeamId);
      if (!home || !away) continue;
      home.gp++; away.gp++;
      home.rf += hs; home.ra += as_;
      away.rf += as_; away.ra += hs;
      if (hs > as_)       { home.w++; home.pts += ptsWin;  away.l++; away.pts += ptsLoss; }
      else if (as_ > hs)  { away.w++; away.pts += ptsWin;  home.l++; home.pts += ptsLoss; }
      else                { home.t++; home.pts += ptsTie;  away.t++; away.pts += ptsTie;  }
    }

    // Split into groups first, then sort WITHIN each group independently
    const groupMap = new Map<string, StatEntry[]>();
    for (const s of statsMap.values()) {
      const key = s.group ?? "";
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(s);
    }

    const cmp = (a: StatEntry, b: StatEntry) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      for (const tb of tbs) {
        const diff = tbv(b.rf, b.ra, b.w, tb) - tbv(a.rf, a.ra, a.w, tb);
        if (diff !== 0) return diff;
      }
      return a.name.localeCompare(b.name);
    };

    const sortedGroupKeys = [...groupMap.keys()].sort((a, b) => {
      if (!a && b) return 1;
      if (a && !b) return -1;
      return a.localeCompare(b);
    });

    groupedStandings = sortedGroupKeys.map(key => {
      const entries = groupMap.get(key)!.sort(cmp);
      const rows: StandingRow[] = entries.map((s, i, arr) => {
        // Equal-rank: walk back while still tied on pts + all tiebreakers
        let rank = i + 1;
        for (let j = i - 1; j >= 0; j--) {
          const prev = arr[j];
          if (prev.pts !== s.pts) break;
          if (tbs.every(tb => tbv(prev.rf, prev.ra, prev.w, tb) === tbv(s.rf, s.ra, s.w, tb))) rank = j + 1;
          else break;
        }
        return {
          ...s, rank,
          pct: s.gp > 0 ? (s.w / s.gp).toFixed(3).replace(/^0/, "") : ".000",
        };
      });
      return { group: key || null, rows };
    });
  }

  // ── Schedule ───────────────────────────────────────────────────────────────
  let upcoming: UpcomingGame[] = [];
  let past: PastGame[] = [];
  let scheduleTeams: SeasonTeam[] = [];

  if (cfg.showSchedule) {
    const upcomingGames = await prisma.game.findMany({
      where: { leagueId: league.id, isPractice: false, status: "SCHEDULED", scheduledAt: { gte: new Date() } },
      orderBy: { scheduledAt: "asc" },
      take: 50,
      select: {
        id: true, scheduledAt: true, startedAt: true, status: true, seasonId: true,
        homeTeamId: true, awayTeamId: true,
        homeTeam: { select: { name: true, logoUrl: true } },
        awayTeam: { select: { name: true, logoUrl: true } },
        field:    { select: { name: true } },
        season:   { select: { defaultGameDurationMins: true } },
        officials: { where: { role: "SCOREKEEPER" }, select: { user: { select: { name: true } } }, take: 1 },
      },
    });

    const pastGames = await prisma.game.findMany({
      where: {
        leagueId: league.id,
        isPractice: false,
        OR: [
          { status: { in: ["COMPLETED", "IN_PROGRESS"] } },
          { status: "SCHEDULED", scheduledAt: { lt: new Date() } },
        ],
      },
      orderBy: { scheduledAt: "desc" },
      take: 30,
      select: {
        id: true, scheduledAt: true, seasonId: true, status: true,
        homeTeamId: true, awayTeamId: true,
        homeScore: true, awayScore: true,
        homeTeam: { select: { name: true, logoUrl: true } },
        awayTeam: { select: { name: true, logoUrl: true } },
        field:    { select: { name: true } },
      },
    });

    if (latestSeason) {
      scheduleTeams = await prisma.team.findMany({
        where: { seasonId: latestSeason.id, isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });
    }

    upcoming = upcomingGames.map(g => ({
      id: g.id, scheduledAt: g.scheduledAt.toISOString(),
      startedAt: g.startedAt?.toISOString() ?? null,
      status: g.status,
      seasonId: g.seasonId,
      homeTeamId: g.homeTeamId, awayTeamId: g.awayTeamId,
      homeTeam: g.homeTeam.name, awayTeam: g.awayTeam.name,
      homeLogoUrl: g.homeTeam.logoUrl ?? null,
      awayLogoUrl: g.awayTeam.logoUrl ?? null,
      fieldName: g.field?.name ?? null,
      scorekeeper: g.officials[0]?.user.name ?? null,
      defaultGameDurationMins: g.season?.defaultGameDurationMins ?? null,
    }));

    past = pastGames.map(g => ({
      id: g.id, scheduledAt: g.scheduledAt.toISOString(), seasonId: g.seasonId,
      homeTeam: g.homeTeam.name, awayTeam: g.awayTeam.name,
      homeTeamId: g.homeTeamId, awayTeamId: g.awayTeamId,
      homeLogoUrl: g.homeTeam.logoUrl ?? null,
      awayLogoUrl: g.awayTeam.logoUrl ?? null,
      homeScore: g.homeScore ?? 0,
      awayScore: g.awayScore ?? 0,
      fieldName: g.field?.name ?? null,
      isLive: g.status === "IN_PROGRESS",
      isPending: g.status === "SCHEDULED",
    }));
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const logoUrl   = league.logoUrl;
  const bannerUrl = league.bannerUrl;
  const hasGroups = groupedStandings.length > 1;
  const half = Math.ceil(groupedStandings.length / 2);
  const leftCol  = groupedStandings.slice(0, half);
  const rightCol = groupedStandings.slice(half);

  return (
    <PublicPageWrapper>
      {/* Responsive grid for multi-group standings */}
      <style>{`
        .pub-sg { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }
        @media (max-width: 640px) { .pub-sg { grid-template-columns: 1fr; } }
      `}</style>

      {/* Hero */}
      <div style={{ position: "relative", overflow: "hidden", minHeight: bannerUrl ? 190 : 260, display: "flex", alignItems: "flex-end" }}>
        {bannerUrl ? (
          <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${bannerUrl})`, backgroundSize: "cover", backgroundPosition: "center" }} />
        ) : logoUrl ? (
          <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${logoUrl})`, backgroundSize: "cover", backgroundPosition: "center", filter: "blur(50px)", transform: "scale(1.3)", opacity: 0.25 }} />
        ) : null}
        <div style={{ position: "absolute", inset: 0, background: bannerUrl ? "linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(10,15,10,0.92) 70%, rgba(10,15,10,1) 100%)" : "linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(10,15,10,0.95) 100%)" }} />
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
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px", display: "flex", flexDirection: "column", gap: 36 }}>

        {/* Description */}
        {cfg.description && (
          <p style={{ color: "var(--pub-text2)", fontSize: 15, lineHeight: 1.7, maxWidth: 700, margin: 0 }}>{cfg.description}</p>
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
                {/* Left column: first half (A,B with 4 groups → A|C, B|D layout) */}
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  {leftCol.map(g => <GroupTable key={g.group ?? "l"} block={g} showPct={showPct} slug={slug} />)}
                </div>
                {/* Right column: second half */}
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  {rightCol.map(g => <GroupTable key={g.group ?? "r"} block={g} showPct={showPct} slug={slug} />)}
                </div>
              </div>
            ) : (
              <GroupTable block={groupedStandings[0]} showPct={showPct} slug={slug} />
            )}
          </section>
        )}

        {/* Schedule (upcoming + results tabs) */}
        {cfg.showSchedule && (
          <ScheduleSection upcoming={upcoming} past={past} seasonTeams={scheduleTeams} />
        )}

        {/* Footer */}
        <footer style={{ borderTop: "1px solid var(--pub-border)", paddingTop: 20, color: "var(--pub-accent)", fontSize: 12, opacity: 0.5, textAlign: "center" }}>
          Powered by Softball Helper
        </footer>
      </div>
    </PublicPageWrapper>
  );
}

const sectionTitle = { fontSize: 18, fontWeight: 700, color: "var(--pub-accent)", margin: "0 0 16px 0" } as React.CSSProperties;
const socialBtn    = { display: "inline-block", padding: "8px 16px", borderRadius: 8, border: "1px solid var(--pub-border)", background: "var(--pub-bg-card)", color: "var(--pub-accent)", textDecoration: "none", fontSize: 13, fontWeight: 600 } as React.CSSProperties;
