import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { flagUrl } from "@/lib/countries";

interface PageProps { params: Promise<{ slug: string }> }

type SocialLinks = { instagram?: string; facebook?: string; whatsapp?: string; twitter?: string };

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
      seasons: { orderBy: { startDate: "desc" }, take: 1 },
    },
  });

  if (!league || !league.publicPage?.published) notFound();

  const cfg = league.publicPage;
  const social = (cfg.socialLinks ?? {}) as SocialLinks;
  const hasSocial = Object.values(social).some(Boolean);

  // Standings from latest season
  let standings: { name: string; gp: number; w: number; l: number; pts: number; logoUrl: string | null }[] = [];
  const latestSeason = league.seasons[0];
  if (cfg.showStandings && latestSeason) {
    const teamLogoMap = new Map(league.teams.map((t) => [t.id, t.logoUrl ?? null]));
    const games = await prisma.game.findMany({
      where: { seasonId: latestSeason.id, status: "COMPLETED" },
      select: { homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true,
                homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } } },
    });
    const map = new Map<string, { name: string; gp: number; w: number; l: number; t: number; pts: number }>();
    for (const g of games) {
      const hs = g.homeScore ?? 0, as_ = g.awayScore ?? 0;
      if (!map.has(g.homeTeamId)) map.set(g.homeTeamId, { name: g.homeTeam.name, gp: 0, w: 0, l: 0, t: 0, pts: 0 });
      if (!map.has(g.awayTeamId)) map.set(g.awayTeamId, { name: g.awayTeam.name, gp: 0, w: 0, l: 0, t: 0, pts: 0 });
      const home = map.get(g.homeTeamId)!, away = map.get(g.awayTeamId)!;
      home.gp++; away.gp++;
      if (hs > as_) { home.w++; home.pts += 2; away.l++; }
      else if (as_ > hs) { away.w++; away.pts += 2; home.l++; }
      else { home.t++; home.pts++; away.t++; away.pts++; }
    }
    standings = [...map.entries()]
      .map(([id, s]) => ({ ...s, logoUrl: teamLogoMap.get(id) ?? null }))
      .sort((a, b) => b.pts - a.pts)
      .slice(0, 10);
  }

  // Upcoming schedule
  let upcoming: { id: string; scheduledAt: string; homeTeam: string; awayTeam: string; seasonId: string }[] = [];
  if (cfg.showSchedule) {
    const games = await prisma.game.findMany({
      where: { leagueId: league.id, status: { in: ["SCHEDULED", "IN_PROGRESS"] }, scheduledAt: { gte: new Date() } },
      orderBy: { scheduledAt: "asc" },
      take: 8,
      select: { id: true, scheduledAt: true, seasonId: true,
                homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } } },
    });
    upcoming = games.map(g => ({ id: g.id, scheduledAt: g.scheduledAt.toISOString(), seasonId: g.seasonId, homeTeam: g.homeTeam.name, awayTeam: g.awayTeam.name }));
  }

  const logoUrl = league.logoUrl;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f0a", color: "#f0fdf4", fontFamily: "sans-serif" }}>
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
          <p style={{ color: "#86efac", fontSize: 15, lineHeight: 1.7, maxWidth: 700 }}>{cfg.description}</p>
        )}

        {/* Social links */}
        {hasSocial && (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {social.instagram && <a href={social.instagram} target="_blank" rel="noreferrer" style={socialBtn}>📸 Instagram</a>}
            {social.facebook  && <a href={social.facebook}  target="_blank" rel="noreferrer" style={socialBtn}>📘 Facebook</a>}
            {social.whatsapp  && <a href={social.whatsapp}  target="_blank" rel="noreferrer" style={socialBtn}>💬 WhatsApp</a>}
            {social.twitter   && <a href={social.twitter}   target="_blank" rel="noreferrer" style={socialBtn}>𝕏 Twitter</a>}
          </div>
        )}

        {/* Standings */}
        {cfg.showStandings && standings.length > 0 && (
          <section>
            <h2 style={sectionTitle}>🏆 Standings {latestSeason && `— ${latestSeason.name}`}</h2>
            <div style={tableWrap}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #1a3a1a" }}>
                    {["#", "Team", "GP", "W", "L", "Pts"].map(h => (
                      <th key={h} style={{ padding: "10px 12px", color: "#4ade80", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: h === "Team" ? "left" : "center" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {standings.map((s, i) => (
                    <tr key={s.name} style={{ borderBottom: "1px solid #111c11" }}>
                      <td style={{ padding: "10px 12px", textAlign: "center", color: i === 0 ? "#fbbf24" : "#4ade80", fontWeight: 700 }}>{i + 1}</td>
                      <td style={{ padding: "10px 12px", color: "#f0fdf4", fontWeight: 600 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {s.logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={s.logoUrl} alt={s.name} style={{ width: 26, height: 26, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
                          ) : (
                            <div style={{ width: 26, height: 26, borderRadius: 6, background: "#14532d", display: "flex", alignItems: "center", justifyContent: "center", color: "#4ade80", fontWeight: 700, fontSize: 11, flexShrink: 0 }}>
                              {s.name.charAt(0)}
                            </div>
                          )}
                          {s.name}
                        </div>
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "center", color: "#86efac" }}>{s.gp}</td>
                      <td style={{ padding: "10px 12px", textAlign: "center", color: "#4ade80", fontWeight: 700 }}>{s.w}</td>
                      <td style={{ padding: "10px 12px", textAlign: "center", color: "#f87171" }}>{s.l}</td>
                      <td style={{ padding: "10px 12px", textAlign: "center", color: "#f0fdf4", fontWeight: 700 }}>{s.pts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Schedule */}
        {cfg.showSchedule && upcoming.length > 0 && (
          <section>
            <h2 style={sectionTitle}>📅 Upcoming Games</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {upcoming.map(g => {
                const d = new Date(g.scheduledAt);
                return (
                  <div key={g.id} style={gameCard}>
                    <span style={{ color: "#4ade80", fontSize: 13, minWidth: 130 }}>
                      {d.toLocaleDateString()} {d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span style={{ color: "#f0fdf4", fontWeight: 600, fontSize: 14 }}>
                      {g.homeTeam} <span style={{ color: "#4ade80", fontWeight: 400 }}>vs</span> {g.awayTeam}
                    </span>
                  </div>
                );
              })}
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
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderRadius: 12, border: "1px solid #1a3a1a", background: "#0d1a0d", textDecoration: "none", transition: "border-color 0.2s" }}>
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

const sectionTitle: React.CSSProperties = { fontSize: 18, fontWeight: 700, color: "#4ade80", marginBottom: 12 };
const tableWrap: React.CSSProperties = { border: "1px solid #1a3a1a", borderRadius: 12, overflow: "hidden", background: "#0d1a0d" };
const gameCard: React.CSSProperties = { display: "flex", alignItems: "center", gap: 16, padding: "12px 16px", borderRadius: 10, border: "1px solid #1a3a1a", background: "#0d1a0d", flexWrap: "wrap" };
const socialBtn: React.CSSProperties = { display: "inline-block", padding: "8px 16px", borderRadius: 8, border: "1px solid #1a3a1a", background: "#0d1a0d", color: "#4ade80", textDecoration: "none", fontSize: 13, fontWeight: 600 };
