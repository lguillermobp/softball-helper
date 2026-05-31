"use client";

import Link from "next/link";
import { useLanguage } from "@/context/language-context";

interface Teammate {
  id: string;
  name: string;
  jerseyNumber: string | null;
}

interface MyTeam {
  id: string;
  name: string;
  manager: { name: string | null; email: string; phone: string | null } | null;
  assistant: { name: string | null; email: string; phone: string | null } | null;
  teammates: Teammate[];
}

interface Season {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
}

interface Props {
  slug: string;
  league: { name: string; city: string | null; state: string | null };
  myTeams: MyTeam[];
  seasons: Season[];
}

function statusBadge(s: string) {
  if (s === "ACTIVE")    return { bg: "#14532d", color: "#4ade80", text: "Active" };
  if (s === "COMPLETED") return { bg: "#1f2937", color: "#9ca3af", text: "Completed" };
  return { bg: "#78350f", color: "#fbbf24", text: "Upcoming" };
}

const card = { borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" };
const dim  = { color: "var(--sh-muted)" };
const head = { color: "var(--sh-text)" };

export function PlayerDashboard({ slug, league, myTeams, seasons }: Props) {
  return (
    <div className="space-y-8">

      {/* My Teams */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold" style={head}>⚾ My Team{myTeams.length !== 1 ? "s" : ""}</h2>

        {myTeams.length === 0 ? (
          <div className="rounded-2xl border py-10 text-center text-sm" style={{ ...card, color: "var(--sh-muted)" }}>
            You are not assigned to any team yet.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {myTeams.map((team) => (
              <div key={team.id} className="rounded-2xl border overflow-hidden" style={card}>
                {/* Team header */}
                <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--sh-border)" }}>
                  <p className="font-bold text-base" style={head}>{team.name}</p>

                  {team.manager && (
                    <div className="mt-2 space-y-0.5">
                      <p className="text-xs" style={dim}>
                        <span className="font-semibold" style={{ color: "var(--sh-primary)" }}>Manager</span>
                        {" · "}
                        <span style={head}>{team.manager.name ?? "—"}</span>
                        {team.manager.email && (
                          <a href={`mailto:${team.manager.email}`} className="ml-1 hover:underline" style={{ color: "var(--sh-secondary)" }}>
                            {team.manager.email}
                          </a>
                        )}
                        {team.manager.phone && <span style={dim}> · {team.manager.phone}</span>}
                      </p>
                    </div>
                  )}

                  {team.assistant && (
                    <p className="text-xs mt-0.5" style={dim}>
                      <span className="font-semibold" style={{ color: "var(--sh-secondary)" }}>Assistant</span>
                      {" · "}
                      <span style={head}>{team.assistant.name ?? "—"}</span>
                      {team.assistant.email && (
                        <a href={`mailto:${team.assistant.email}`} className="ml-1 hover:underline" style={{ color: "var(--sh-secondary)" }}>
                          {team.assistant.email}
                        </a>
                      )}
                    </p>
                  )}
                </div>

                {/* Roster */}
                <div className="px-5 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={dim}>
                    Roster ({team.teammates.length})
                  </p>
                  {team.teammates.length === 0 ? (
                    <p className="text-xs" style={dim}>No players yet.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {team.teammates.map((p) => (
                        <li key={p.id} className="flex items-center gap-2">
                          {p.jerseyNumber ? (
                            <span className="text-xs font-bold w-7 text-right shrink-0" style={{ color: "var(--sh-primary)" }}>
                              #{p.jerseyNumber}
                            </span>
                          ) : (
                            <span className="w-7 shrink-0" />
                          )}
                          <span className="text-sm" style={head}>{p.name}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Seasons */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold" style={head}>📅 Seasons</h2>

        {seasons.length === 0 ? (
          <div className="rounded-2xl border py-10 text-center text-sm" style={{ ...card, color: "var(--sh-muted)" }}>
            No seasons yet.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {seasons.map((season) => {
              const badge = statusBadge(season.status);
              return (
                <Link key={season.id} href={`/league/${slug}/season/${season.id}`} className="group block">
                  <div className="rounded-xl border p-4 flex items-center justify-between transition-opacity group-hover:opacity-80" style={card}>
                    <div>
                      <p className="font-semibold" style={head}>{season.name}</p>
                      <p className="text-xs mt-0.5" style={dim}>
                        {new Date(season.startDate).toLocaleDateString()} – {new Date(season.endDate).toLocaleDateString()}
                      </p>
                      <p className="text-xs mt-1" style={{ color: "var(--sh-primary)" }}>View schedule & standings →</p>
                    </div>
                    <span className="text-xs font-semibold rounded-full px-3 py-1 shrink-0"
                      style={{ background: badge.bg, color: badge.color }}>
                      {badge.text}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

    </div>
  );
}
