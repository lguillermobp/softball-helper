import type React from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { flagUrl } from "@/lib/countries";
import { computeSeasonStats, type BatterRow } from "@/lib/stats";
import { PublicPageWrapper } from "@/components/public/PublicPageWrapper";
import { ScheduleSection } from "@/components/public/ScheduleSection";
import type { UpcomingGame, PastGame } from "@/components/public/ScheduleSection";

interface PageProps { params: Promise<{ slug: string; teamId: string }> }

type SocialLinks = { instagram?: string; facebook?: string; whatsapp?: string; twitter?: string };

interface StatEntry {
  teamId: string; name: string; logoUrl: string | null;
  gp: number; w: number; l: number; t: number;
  pts: number; rf: number; ra: number;
}

interface StandingRow extends StatEntry { rank: number; pct: string }

export default async function TeamPublicPage({ params }: PageProps) {
  const { slug, teamId } = await params;

  const team = await prisma.team.findFirst({
    where: { id: teamId, league: { slug } },
    include: {
      publicPage: true,
      league: { select: { id: true, name: true, slug: true } },
      manager:   { select: { id: true, name: true } },
      assistant: { select: { id: true, name: true } },
      players: {
        where: { name: { not: "" } },
        orderBy: { name: "asc" },
        select: { id: true, name: true, jerseyNumber: true, photoUrl: true, nationality: true, userId: true },
      },
    },
  });

  if (!team || !team.publicPage?.published) notFound();

  const cfg = team.publicPage;
  const social = (cfg.socialLinks ?? {}) as SocialLinks;
  const hasSocial = Object.values(social).some(Boolean);
  const logoUrl = team.logoUrl;

  // ── Standings ────────────────────────────────────────────────────────────────
  let groupRows: StandingRow[] = [];

  if (team.seasonId) {
    const [seasonCfg, allTeams, completedGames] = await Promise.all([
      prisma.season.findUnique({
        where: { id: team.seasonId },
        select: { pointsWin: true, pointsTie: true, pointsLoss: true, tiebreakers: true, showPct: true },
      }),
      prisma.team.findMany({
        where: { seasonId: team.seasonId },
        select: { id: true, name: true, group: true, logoUrl: true },
      }),
      prisma.game.findMany({
        where: { seasonId: team.seasonId, status: "COMPLETED" },
        select: { homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true },
      }),
    ]);

    if (seasonCfg) {
      const pW = seasonCfg.pointsWin;
      const pT = seasonCfg.pointsTie;
      const pL = seasonCfg.pointsLoss;

      const statsMap = new Map<string, StatEntry>();
      for (const t of allTeams) {
        statsMap.set(t.id, { teamId: t.id, name: t.name, logoUrl: t.logoUrl, gp: 0, w: 0, l: 0, t: 0, pts: 0, rf: 0, ra: 0 });
      }
      for (const g of completedGames) {
        const home = statsMap.get(g.homeTeamId);
        const away = statsMap.get(g.awayTeamId);
        if (!home || !away) continue;
        const hs = g.homeScore ?? 0;
        const as_ = g.awayScore ?? 0;
        home.gp++; away.gp++;
        home.rf += hs; home.ra += as_;
        away.rf += as_; away.ra += hs;
        if (hs > as_)      { home.w++; home.pts += pW; away.l++; away.pts += pL; }
        else if (hs < as_) { away.w++; away.pts += pW; home.l++; home.pts += pL; }
        else               { home.t++; home.pts += pT; away.t++; away.pts += pT; }
      }

      const thisTeam = allTeams.find(t => t.id === teamId);
      const myGroup = thisTeam?.group ?? null;
      const groupTeamIds = new Set(allTeams.filter(t => (t.group ?? null) === myGroup).map(t => t.id));
      const entries = [...statsMap.values()].filter(e => groupTeamIds.has(e.teamId));

      const tbs = (seasonCfg.tiebreakers ?? "PTS,RD,RF").split(",").map(s => s.trim());
      const tbv = (e: StatEntry, tb: string) => {
        if (tb === "PTS") return e.pts;
        if (tb === "RD")  return e.rf - e.ra;
        if (tb === "RF")  return e.rf;
        if (tb === "W")   return e.w;
        return 0;
      };
      const cmp = (a: StatEntry, b: StatEntry) => {
        for (const tb of tbs) { const d = tbv(b, tb) - tbv(a, tb); if (d !== 0) return d; }
        return a.name.localeCompare(b.name);
      };
      const sorted = entries.sort(cmp);
      groupRows = sorted.map((e, i, arr) => {
        let rank = i + 1;
        for (let j = i - 1; j >= 0; j--) {
          const prev = arr[j];
          if (tbs.every(tb => tbv(prev, tb) === tbv(e, tb))) rank = j + 1; else break;
        }
        return { ...e, rank, pct: e.gp > 0 ? (e.w / e.gp).toFixed(3).replace(/^0/, "") : ".000" };
      });
    }
  }

  // ── Season stats (unofficial) ────────────────────────────────────────────────
  let seasonStats: Awaited<ReturnType<typeof computeSeasonStats>> = [];
  if (cfg.showStats && team.seasonId) {
    const scorebooks = await prisma.managerScorebook.findMany({
      where: { teamId, game: { seasonId: team.seasonId } },
      select: { gameId: true, data: true },
    });
    const gameIds = scorebooks.map(s => s.gameId);
    const lineupEntries = await prisma.gameLineup.findMany({
      where: { gameId: { in: gameIds }, player: { teamId }, battingOrder: { not: null } },
      select: { gameId: true, battingOrder: true, player: { select: { id: true, name: true, jerseyNumber: true, photoUrl: true, nationality: true } } },
    });
    const lineupsByGame = new Map<string, BatterRow[]>();
    for (const e of lineupEntries) {
      const rows = lineupsByGame.get(e.gameId) ?? [];
      rows.push({ playerId: e.player.id, battingOrder: e.battingOrder!, name: e.player.name, jerseyNumber: e.player.jerseyNumber ?? null, photoUrl: e.player.photoUrl ?? null, nationality: e.player.nationality ?? null });
      lineupsByGame.set(e.gameId, rows);
    }
    const entries = scorebooks.map(sb => {
      const data = sb.data as { offense?: Record<string, Record<string, string>> } | null;
      return { lineup: lineupsByGame.get(sb.gameId) ?? [], offense: data?.offense ?? null };
    });
    seasonStats = computeSeasonStats(entries).filter(s => s.ab > 0);
  }

  // ── Upcoming games ───────────────────────────────────────────────────────────
  let upcoming: UpcomingGame[] = [];
  if (cfg.showSchedule) {
    const games = await prisma.game.findMany({
      where: { OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }], status: { in: ["SCHEDULED", "IN_PROGRESS"] }, scheduledAt: { gte: new Date() } },
      orderBy: { scheduledAt: "asc" },
      take: 20,
      select: {
        id: true, scheduledAt: true, startedAt: true, status: true,
        homeTeamId: true, awayTeamId: true,
        homeTeam: { select: { name: true, logoUrl: true } },
        awayTeam: { select: { name: true, logoUrl: true } },
        field:    { select: { name: true } },
        season:   { select: { defaultGameDurationMins: true } },
        officials: { where: { role: "SCOREKEEPER" }, select: { user: { select: { name: true } } }, take: 1 },
      },
    });
    upcoming = games.map(g => ({
      id: g.id,
      scheduledAt: g.scheduledAt.toISOString(),
      startedAt: g.startedAt?.toISOString() ?? null,
      status: g.status,
      homeTeamId: g.homeTeamId,
      awayTeamId: g.awayTeamId,
      homeTeam: g.homeTeam.name,
      awayTeam: g.awayTeam.name,
      homeLogoUrl: g.homeTeam.logoUrl ?? null,
      awayLogoUrl: g.awayTeam.logoUrl ?? null,
      fieldName: g.field?.name ?? null,
      scorekeeper: g.officials[0]?.user.name ?? null,
      defaultGameDurationMins: g.season?.defaultGameDurationMins ?? null,
    }));
  }

  // ── Completed games ──────────────────────────────────────────────────────────
  let pastGames: PastGame[] = [];
  {
    const games = await prisma.game.findMany({
      where: { OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }], status: "COMPLETED" },
      orderBy: { scheduledAt: "desc" },
      take: 20,
      select: {
        id: true, scheduledAt: true, homeScore: true, awayScore: true,
        homeTeam: { select: { name: true, logoUrl: true } },
        awayTeam: { select: { name: true, logoUrl: true } },
        field:    { select: { name: true } },
      },
    });
    pastGames = games.map(g => ({
      id: g.id,
      scheduledAt: g.scheduledAt.toISOString(),
      homeTeam: g.homeTeam.name,
      awayTeam: g.awayTeam.name,
      homeLogoUrl: g.homeTeam.logoUrl ?? null,
      awayLogoUrl: g.awayTeam.logoUrl ?? null,
      homeScore: g.homeScore ?? 0,
      awayScore: g.awayScore ?? 0,
      fieldName: g.field?.name ?? null,
    }));
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  const myRow = groupRows.find(r => r.teamId === teamId);

  return (
    <PublicPageWrapper>
      {/* Hero — colors stay hardcoded (always on dark gradient overlay) */}
      <div style={{ position: "relative", overflow: "hidden", minHeight: 240, display: "flex", alignItems: "flex-end" }}>
        {logoUrl && (
          <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${logoUrl})`, backgroundSize: "cover", backgroundPosition: "center", filter: "blur(50px)", transform: "scale(1.3)", opacity: 0.3 }} />
        )}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(10,15,10,0.95) 100%)" }} />
        <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 960, margin: "0 auto", padding: "40px 24px 28px" }}>
          <Link href={`/league/${slug}/public`} style={{ color: "#4ade80", fontSize: 13, textDecoration: "none", display: "inline-block", marginBottom: 12 }}>
            ← {team.league.name}
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={team.name} style={{ width: 72, height: 72, borderRadius: 14, objectFit: "cover", border: "2px solid rgba(74,222,128,0.3)" }} />
            ) : (
              <div style={{ width: 72, height: 72, borderRadius: 14, background: "#14532d", display: "flex", alignItems: "center", justifyContent: "center", color: "#4ade80", fontWeight: 800, fontSize: 28 }}>
                {team.name.charAt(0)}
              </div>
            )}
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f0fdf4", margin: 0 }}>{team.name}</h1>
              <p style={{ color: "#86efac", fontSize: 13, margin: "4px 0 0" }}>{team.league.name}</p>
            </div>
            {myRow && (
              <div style={{ marginLeft: "auto", textAlign: "center", padding: "10px 20px", borderRadius: 12, border: "1px solid rgba(74,222,128,0.3)", background: "rgba(74,222,128,0.07)" }}>
                <div style={{ fontSize: 11, color: "#4ade80", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Standing</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: "#4ade80", lineHeight: 1 }}>#{myRow.rank}</div>
                <div style={{ fontSize: 12, color: "#86efac", marginTop: 2 }}>{myRow.gp} GP · {myRow.pts} pts</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px", display: "flex", flexDirection: "column", gap: 32 }}>

        {cfg.description && (
          <p style={{ color: "var(--pub-text2)", fontSize: 15, lineHeight: 1.7 }}>{cfg.description}</p>
        )}

        {hasSocial && (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {social.instagram && <a href={social.instagram} target="_blank" rel="noreferrer" style={socialBtn}>📸 Instagram</a>}
            {social.facebook  && <a href={social.facebook}  target="_blank" rel="noreferrer" style={socialBtn}>📘 Facebook</a>}
            {social.whatsapp  && <a href={social.whatsapp}  target="_blank" rel="noreferrer" style={socialBtn}>💬 WhatsApp</a>}
            {social.twitter   && <a href={social.twitter}   target="_blank" rel="noreferrer" style={socialBtn}>𝕏 Twitter</a>}
          </div>
        )}

        {/* Standings */}
        {groupRows.length > 0 && (
          <section>
            <h2 style={sectionTitle}>🏆 Standings</h2>
            <div style={{ border: "1px solid var(--pub-border)", borderRadius: 12, overflow: "hidden", background: "var(--pub-bg-card)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--pub-border)" }}>
                    {["#", "Team", "GP", "W", "L", "T", "Pts", "RD"].map(h => (
                      <th key={h} style={{ padding: "10px 10px", color: "var(--pub-accent)", fontWeight: 700, fontSize: 11, textTransform: "uppercase", textAlign: h === "Team" ? "left" : "center" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groupRows.map((r, i) => {
                    const isMe = r.teamId === teamId;
                    const rd = r.rf - r.ra;
                    const rdColor = rd > 0 ? "var(--pub-accent)" : rd < 0 ? "var(--pub-danger)" : "var(--pub-text2)";
                    const rdText  = rd > 0 ? `+${rd}` : String(rd);
                    return (
                      <tr key={r.teamId} style={{ borderBottom: i < groupRows.length - 1 ? "1px solid var(--pub-border2)" : "none", background: isMe ? "var(--pub-accent-subtle)" : "transparent" }}>
                        <td style={{ padding: "9px 10px", textAlign: "center", color: "var(--pub-accent)", fontWeight: 700 }}>{r.rank}</td>
                        <td style={{ padding: "9px 10px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {r.logoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={r.logoUrl} alt={r.name} style={{ width: 22, height: 22, borderRadius: 4, objectFit: "cover", flexShrink: 0 }} />
                            ) : (
                              <div style={{ width: 22, height: 22, borderRadius: 4, background: "var(--pub-logo-bg)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--pub-accent)", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{r.name.charAt(0)}</div>
                            )}
                            <span style={{ color: isMe ? "var(--pub-accent)" : "var(--pub-text)", fontWeight: isMe ? 700 : 500 }}>{r.name}</span>
                            {isMe && <span style={{ fontSize: 10, color: "var(--pub-accent)", background: "var(--pub-accent-a10)", borderRadius: 10, padding: "1px 7px", fontWeight: 700 }}>YOU</span>}
                          </div>
                        </td>
                        <td style={{ padding: "9px 10px", textAlign: "center", color: "var(--pub-text2)" }}>{r.gp}</td>
                        <td style={{ padding: "9px 10px", textAlign: "center", color: "var(--pub-accent)", fontWeight: 600 }}>{r.w}</td>
                        <td style={{ padding: "9px 10px", textAlign: "center", color: "var(--pub-text2)" }}>{r.l}</td>
                        <td style={{ padding: "9px 10px", textAlign: "center", color: "var(--pub-text2)" }}>{r.t}</td>
                        <td style={{ padding: "9px 10px", textAlign: "center", color: "var(--pub-text)", fontWeight: 700 }}>{r.pts}</td>
                        <td style={{ padding: "9px 10px", textAlign: "center", color: rdColor, fontWeight: 600 }}>{rdText}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Roster */}
        {cfg.showRoster && team.players.length > 0 && (
          <section>
            <h2 style={sectionTitle}>👕 Roster</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 10 }}>
              {team.players.map(p => {
                const isManager   = !!team.managerId   && p.userId === team.managerId;
                const isAssistant = !!team.assistantId && p.userId === team.assistantId;
                return (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, border: `1px solid ${isManager ? "rgba(74,222,128,0.4)" : isAssistant ? "rgba(147,197,253,0.35)" : "var(--pub-border)"}`, background: isManager ? "var(--pub-accent-subtle)" : isAssistant ? "rgba(147,197,253,0.05)" : "var(--pub-bg-card)" }}>
                    {p.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.photoUrl} alt={p.name} style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 40, height: 40, borderRadius: "50%", background: isAssistant ? "#1e3a5f" : "var(--pub-logo-bg)", display: "flex", alignItems: "center", justifyContent: "center", color: isAssistant ? "#93c5fd" : "var(--pub-accent)", fontWeight: 700, fontSize: 15, flexShrink: 0 }}>
                        {p.name.charAt(0)}
                      </div>
                    )}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        {p.nationality && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={flagUrl(p.nationality)} alt={p.nationality} style={{ width: 18, height: 13, objectFit: "cover", borderRadius: 2, flexShrink: 0 }} />
                        )}
                        <span style={{ color: "var(--pub-text)", fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
                        {p.jerseyNumber && <span style={{ color: "var(--pub-accent)", fontSize: 12 }}>#{p.jerseyNumber}</span>}
                        {isManager   && <span style={{ fontSize: 10, fontWeight: 700, color: "var(--pub-accent)",  background: "var(--pub-accent-a10)",           borderRadius: 8, padding: "1px 7px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Manager</span>}
                        {isAssistant && <span style={{ fontSize: 10, fontWeight: 700, color: "#93c5fd", background: "rgba(147,197,253,0.15)", borderRadius: 8, padding: "1px 7px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Assistant</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Stats */}
        {cfg.showStats && seasonStats.length > 0 && (
          <section>
            <h2 style={sectionTitle}>📊 Season Stats <span style={{ fontSize: 11, color: "var(--pub-accent)", opacity: 0.6, fontWeight: 400 }}>Unofficial</span></h2>
            <div style={{ border: "1px solid var(--pub-border)", borderRadius: 12, overflow: "hidden", background: "var(--pub-bg-card)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--pub-border)" }}>
                    {["#", "Player", "AB", "H", "1B", "2B", "3B", "HR", "BA"].map(h => (
                      <th key={h} style={{ padding: "10px 10px", color: "var(--pub-accent)", fontWeight: 700, fontSize: 11, textTransform: "uppercase", textAlign: h === "Player" ? "left" : "center" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {seasonStats.map((s, i) => (
                    <tr key={s.playerId} style={{ borderBottom: i < seasonStats.length - 1 ? "1px solid var(--pub-border2)" : "none" }}>
                      <td style={{ padding: "9px 10px", color: "var(--pub-accent)", fontWeight: 700, textAlign: "center" }}>{s.jerseyNumber ? `#${s.jerseyNumber}` : "—"}</td>
                      <td style={{ padding: "9px 10px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {s.photoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={s.photoUrl} alt={s.name} style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} />
                          ) : (
                            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--pub-logo-bg)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--pub-accent)", fontSize: 12, fontWeight: 700 }}>{s.name.charAt(0)}</div>
                          )}
                          {s.nationality && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={flagUrl(s.nationality)} alt={s.nationality} style={{ width: 16, height: 11, objectFit: "cover", borderRadius: 2 }} />
                          )}
                          <span style={{ color: "var(--pub-text)", fontWeight: 600 }}>{s.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: "9px 10px", textAlign: "center", color: "var(--pub-text2)" }}>{s.ab}</td>
                      <td style={{ padding: "9px 10px", textAlign: "center", color: "var(--pub-accent)", fontWeight: 600 }}>{s.h}</td>
                      <td style={{ padding: "9px 10px", textAlign: "center", color: "var(--pub-text2)" }}>{s.singles}</td>
                      <td style={{ padding: "9px 10px", textAlign: "center", color: "#93c5fd" }}>{s.doubles}</td>
                      <td style={{ padding: "9px 10px", textAlign: "center", color: "#a78bfa" }}>{s.triples}</td>
                      <td style={{ padding: "9px 10px", textAlign: "center", color: "var(--pub-gold)", fontWeight: 600 }}>{s.hr}</td>
                      <td style={{ padding: "9px 10px", textAlign: "center", color: "var(--pub-text)", fontWeight: 700 }}>{s.ba}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Schedule — same rich cards as the league public page */}
        {cfg.showSchedule && (
          <ScheduleSection upcoming={upcoming} past={pastGames} />
        )}

        <footer style={{ borderTop: "1px solid var(--pub-border)", paddingTop: 20, color: "var(--pub-accent)", fontSize: 12, opacity: 0.5, textAlign: "center" }}>
          Powered by Softball Helper
        </footer>
      </div>
    </PublicPageWrapper>
  );
}

const sectionTitle: React.CSSProperties = { fontSize: 18, fontWeight: 700, color: "var(--pub-accent)", marginBottom: 12 };
const socialBtn: React.CSSProperties = { display: "inline-block", padding: "8px 16px", borderRadius: 8, border: "1px solid var(--pub-border)", background: "var(--pub-bg-card)", color: "var(--pub-accent)", textDecoration: "none", fontSize: 13, fontWeight: 600 };
