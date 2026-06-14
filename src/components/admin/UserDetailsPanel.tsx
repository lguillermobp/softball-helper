"use client";

import { useEffect, useState } from "react";

export interface UserDetails {
  id: string; name: string | null; email: string; phone: string | null;
  isMasterAdmin: boolean; isSupportTechnician: boolean;
  isActive: boolean; createdAt: string;
  leagueRoles:    Array<{ leagueName: string; leagueSlug: string; role: string }>;
  managedTeams:   Array<{ id: string; name: string; leagueName: string }>;
  assistedTeams:  Array<{ id: string; name: string; leagueName: string }>;
  playerProfiles: Array<{ id: string; teamName: string; leagueName: string }>;
  officialStats:  Array<{ role: string; count: number }>;
  battingStats:   { ab: number; h: number; doubles: number; triples: number; hr: number; bb: number; k: number; ba: string } | null;
  technicianLeagues: Array<{ id: string; name: string; slug: string }>;
}

interface Props {
  userId: string | null;
  onClose: () => void;
  fetchUrl: (id: string) => string;
}

const ROLE_LABELS: Record<string, string> = {
  LEAGUE_ADMIN: "League Admin", UMPIRE: "Umpire", SCOREKEEPER: "Scorekeeper",
  TEAM_MANAGER: "Team Manager", TEAM_MANAGER_PLAYER: "Manager / Player",
  TEAM_ASSISTANT: "Team Assistant", TEAM_ASSISTANT_PLAYER: "Assistant / Player",
  PLAYER: "Player",
};
function rl(r: string) { return ROLE_LABELS[r] ?? r.replace(/_/g, " "); }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--sh-muted)", marginBottom: 8 }}>
        {title}
      </p>
      {children}
    </section>
  );
}

function Row({ left, right, sub }: { left: string; right?: React.ReactNode; sub?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 8, background: "var(--sh-bg-card2)", border: "1px solid var(--sh-border)", gap: 8 }}>
      <div style={{ minWidth: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--sh-text)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{left}</span>
        {sub && <span style={{ fontSize: 11, color: "var(--sh-muted)" }}>{sub}</span>}
      </div>
      {right}
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "2px 8px", background: "#1a3d1a", color: "#4ade80", flexShrink: 0 }}>
      {rl(role)}
    </span>
  );
}

export function UserDetailsPanel({ userId, onClose, fetchUrl }: Props) {
  const [details, setDetails] = useState<UserDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!userId) { setDetails(null); return; }
    setLoading(true); setError(null); setDetails(null);
    fetch(fetchUrl(userId))
      .then(r => r.ok ? r.json() : r.json().then((d: any) => Promise.reject(d.error ?? r.statusText)))
      .then(setDetails)
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [userId, fetchUrl]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!userId) return null;

  const d = details;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 40 }} />

      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: "min(520px, 100vw)",
        background: "var(--sh-bg-card)", borderLeft: "1px solid var(--sh-border)",
        zIndex: 50, overflowY: "auto", padding: "20px 24px",
        display: "flex", flexDirection: "column", gap: 20,
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--sh-text)", margin: 0 }}>User Profile</h2>
          <button onClick={onClose} style={{ fontSize: 20, lineHeight: 1, color: "var(--sh-muted)", background: "none", border: "none", cursor: "pointer", padding: 4 }}>✕</button>
        </div>

        {loading && <p style={{ color: "var(--sh-muted)", fontSize: 14 }}>Loading…</p>}
        {error   && <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p>}

        {d && (
          <>
            {/* Identity card */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: 16, borderRadius: 12, background: "var(--sh-bg-card2)", border: "1px solid var(--sh-border)" }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--sh-bg-card)", border: "2px solid var(--sh-border2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, color: "var(--sh-primary)", flexShrink: 0 }}>
                {(d.name ?? d.email).charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 700, fontSize: 15, color: "var(--sh-text)", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name ?? "—"}</p>
                <p style={{ fontSize: 12, color: "var(--sh-muted)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.email}</p>
                {d.phone && <p style={{ fontSize: 12, color: "var(--sh-muted)", margin: "3px 0 0" }}>📞 {d.phone}</p>}
                <p style={{ fontSize: 11, color: "var(--sh-muted)", margin: "4px 0 0", opacity: 0.6 }}>Joined {new Date(d.createdAt).toLocaleDateString()}</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "2px 8px", background: d.isActive ? "var(--sh-approved-bg)" : "var(--sh-inactive-bg)", color: d.isActive ? "var(--sh-primary)" : "var(--sh-inactive)" }}>
                  {d.isActive ? "Active" : "Inactive"}
                </span>
                {d.isMasterAdmin       && <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "2px 8px", background: "var(--sh-purple-bg)", color: "var(--sh-purple)" }}>★ Master Admin</span>}
                {d.isSupportTechnician && <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "2px 8px", background: "#164e63", color: "#67e8f9" }}>🎫 Technician</span>}
              </div>
            </div>

            {/* Leagues */}
            {d.leagueRoles.length > 0 && (
              <Section title={`Leagues (${d.leagueRoles.length})`}>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {d.leagueRoles.map((lr, i) => (
                    <Row key={i} left={lr.leagueName} right={<RoleBadge role={lr.role} />} />
                  ))}
                </div>
              </Section>
            )}

            {/* Managed teams */}
            {d.managedTeams.length > 0 && (
              <Section title="Manages">
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {d.managedTeams.map(t => (
                    <Row key={t.id} left={t.name} sub={t.leagueName} right={<RoleBadge role="TEAM_MANAGER" />} />
                  ))}
                </div>
              </Section>
            )}

            {/* Assisted teams */}
            {d.assistedTeams.length > 0 && (
              <Section title="Assists">
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {d.assistedTeams.map(t => (
                    <Row key={t.id} left={t.name} sub={t.leagueName} right={<RoleBadge role="TEAM_ASSISTANT" />} />
                  ))}
                </div>
              </Section>
            )}

            {/* Player profiles */}
            {d.playerProfiles.length > 0 && (
              <Section title="Player Profiles">
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {d.playerProfiles.map(p => (
                    <Row key={p.id} left={p.teamName} sub={p.leagueName} right={<RoleBadge role="PLAYER" />} />
                  ))}
                </div>
              </Section>
            )}

            {/* Official activity */}
            {d.officialStats.length > 0 && (
              <Section title="Official Activity">
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {d.officialStats.map(s => (
                    <div key={s.role} style={{ flex: 1, minWidth: 110, padding: "14px 16px", borderRadius: 10, background: "var(--sh-bg-card2)", border: "1px solid var(--sh-border)", textAlign: "center" }}>
                      <p style={{ fontSize: 28, fontWeight: 800, color: "var(--sh-primary)", lineHeight: 1, margin: 0 }}>{s.count}</p>
                      <p style={{ fontSize: 11, color: "var(--sh-muted)", marginTop: 5 }}>
                        {s.role === "SCOREKEEPER" ? "Games Scored" : "Games Umped"}
                      </p>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Batting stats */}
            {d.battingStats && (
              <Section title="Batting Stats">
                <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid var(--sh-border)" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--sh-border)" }}>
                        {["AB","H","2B","3B","HR","BB","K","BA"].map(h => (
                          <th key={h} style={{ padding: "8px 6px", textAlign: "center", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--sh-muted)", background: "var(--sh-bg-card2)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ padding: "10px 6px", textAlign: "center", color: "var(--sh-text)", fontWeight: 600 }}>{d.battingStats.ab}</td>
                        <td style={{ padding: "10px 6px", textAlign: "center", color: "var(--sh-primary)", fontWeight: 700 }}>{d.battingStats.h}</td>
                        <td style={{ padding: "10px 6px", textAlign: "center", color: "var(--sh-text)" }}>{d.battingStats.doubles}</td>
                        <td style={{ padding: "10px 6px", textAlign: "center", color: "var(--sh-text)" }}>{d.battingStats.triples}</td>
                        <td style={{ padding: "10px 6px", textAlign: "center", color: "#fbbf24", fontWeight: 700 }}>{d.battingStats.hr}</td>
                        <td style={{ padding: "10px 6px", textAlign: "center", color: "var(--sh-text)" }}>{d.battingStats.bb}</td>
                        <td style={{ padding: "10px 6px", textAlign: "center", color: "var(--sh-text)" }}>{d.battingStats.k}</td>
                        <td style={{ padding: "10px 6px", textAlign: "center", color: "var(--sh-primary)", fontWeight: 800 }}>{d.battingStats.ba}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Section>
            )}

            {/* Technician leagues (admin only) */}
            {d.technicianLeagues.length > 0 && (
              <Section title="Technician For">
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {d.technicianLeagues.map(l => (
                    <div key={l.id} style={{ padding: "8px 12px", borderRadius: 8, background: "#0c2231", border: "1px solid #0e7490" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#67e8f9" }}>{l.name}</span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Empty state */}
            {d.leagueRoles.length === 0 && d.managedTeams.length === 0 && d.assistedTeams.length === 0 && d.playerProfiles.length === 0 && d.officialStats.length === 0 && (
              <p style={{ fontSize: 13, color: "var(--sh-muted)", textAlign: "center", padding: "20px 0" }}>
                No league activity found for this user.
              </p>
            )}
          </>
        )}
      </div>
    </>
  );
}
