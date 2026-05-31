"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/context/language-context";
import Link from "next/link";
import { AddSeasonDialog } from "@/components/league/AddSeasonDialog";
import { AddCategoryDialog } from "@/components/league/AddCategoryDialog";
import { AddTeamDialog } from "@/components/league/AddTeamDialog";
import { EditTeamDialog } from "@/components/league/EditTeamDialog";
import { AddPlayerDialog } from "@/components/league/AddPlayerDialog";
import { AddMemberDialog } from "@/components/league/AddMemberDialog";
import { ResendVerificationButton } from "@/components/league/ResendVerificationButton";
import { AddFieldDialog } from "@/components/league/AddFieldDialog";
import { UploadPlayersDialog } from "@/components/league/UploadPlayersDialog";
import { PlayerPhotoDialog } from "@/components/league/PlayerPhotoDialog";
import { ConditionsSection } from "@/components/league/ConditionsSection";
import { EditPlayerDialog } from "@/components/league/EditPlayerDialog";
import { BroadcastDialog } from "@/components/league/BroadcastDialog";
import { TeamLogoUpload } from "@/components/league/TeamLogoUpload";
import { LeagueLogoUpload } from "@/components/league/LeagueLogoUpload";
import { TeamAvatar } from "@/components/ui/TeamAvatar";

// ── Types ─────────────────────────────────────────────────────────────────────

type Section = "overview" | "seasons" | "categories" | "teams" | "members" | "fields" | "conditions";

interface Season { id: string; name: string; startDate: string; endDate: string; status: string }
interface Category { id: string; name: string; description: string | null }
interface Player { id: string; name: string; email: string | null; jerseyNumber: string | null; photoUrl: string | null; userId: string | null; invitePending: boolean }
interface StaffMember { id: string; name: string | null; email: string; phone: string | null }
interface Team {
  id: string; name: string; logoUrl: string | null; status: string; isActive: boolean;
  seasonId: string | null; categoryId: string | null;
  season: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
  manager: StaffMember | null;
  assistant: StaffMember | null;
  players: Player[];
}
interface Member {
  id: string; role: string;
  user: { id: string; name: string | null; email: string; phone: string | null; emailVerified: string | null };
}

function ResetPasswordButton({ slug, userId, tl }: { slug: string; userId: string; tl: { resetPassword: string; resetSending: string; resetSent: string } }) {
  const [status, setStatus] = React.useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handle() {
    setStatus("sending");
    const res = await fetch(`/api/leagues/${slug}/members/${userId}/reset-password`, { method: "POST" });
    setStatus(res.ok ? "sent" : "error");
    if (res.ok) setTimeout(() => setStatus("idle"), 3000);
  }

  return (
    <button
      onClick={handle}
      disabled={status === "sending" || status === "sent"}
      className="text-xs px-2 py-1 rounded-md border hover:opacity-80 disabled:opacity-60"
      style={{ borderColor: "var(--sh-border2)", color: "#fbbf24", background: "transparent" }}
    >
      {status === "sending" ? tl.resetSending : status === "sent" ? tl.resetSent : status === "error" ? "Failed" : tl.resetPassword}
    </button>
  );
}
interface Field { id: string; name: string; types: string[] }
interface Condition {
  id: string; title: string; content: string | null;
  fileUrl: string | null; fileName: string | null; fileType: string | null;
  order: number; createdAt: string;
  createdBy: { id: string; name: string | null; email: string };
}

interface Props {
  slug: string;
  isAdmin: boolean;
  currentUserId: string;
  league: { id: string; name: string; city: string | null; state: string | null; status: string; logoUrl: string | null; plan: { name: string } };
  seasons: Season[];
  categories: Category[];
  teams: Team[];
  members: Member[];
  fields: Field[];
  conditions: Condition[];
}

// ── Styles (CSS variables — adapt to dark/light theme) ────────────────────────

const card  = { borderColor: "var(--sh-border)",    background: "var(--sh-bg-card)" };
const dim   = { color: "var(--sh-muted)" };
const muted = { color: "var(--sh-primary)" };
const head  = { color: "var(--sh-text)" };

function roleLabel(r: string) { return r.replace(/_/g, " "); }

function seasonBadge(s: string) {
  if (s === "ACTIVE")    return { bg: "#14532d", color: "#4ade80", text: "Active" };
  if (s === "COMPLETED") return { bg: "#1f2937", color: "#9ca3af", text: "Completed" };
  return { bg: "#78350f", color: "#fbbf24", text: "Upcoming" };
}

// FIELD_TYPE_LABELS filled from translations at render time
const FIELD_TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  MORNING:   { bg: "#78350f", color: "#fbbf24" },
  AFTERNOON: { bg: "#1e3a5f", color: "#93c5fd" },
  NIGHT:     { bg: "#1a1a3d", color: "#a78bfa" },
};

// ── Nav items ─────────────────────────────────────────────────────────────────

// Nav items — labels filled dynamically from translations in the component
const NAV_KEYS: { key: Section; icon: string; adminOnly?: boolean }[] = [
  { key: "overview",   icon: "⚾" },
  { key: "seasons",    icon: "📅" },
  { key: "categories", icon: "🏷️" },
  { key: "teams",      icon: "👥" },
  { key: "members",    icon: "🙋", adminOnly: true },
  { key: "fields",     icon: "🏟️" },
  { key: "conditions", icon: "📋" },
];

// ── Main component ────────────────────────────────────────────────────────────

export function LeagueDashboard({ slug, isAdmin, currentUserId, league, seasons, categories, teams, members, fields, conditions }: Props) {
  const router = useRouter();
  const { t } = useLanguage();
  const tl = t.league;
  const [section, setSection] = useState<Section>("overview");
  const [showInactive, setShowInactive] = useState(false);
  const [teamError, setTeamError] = useState<Record<string, string>>({});
  const [playerPhotos, setPlayerPhotos] = useState<Record<string, string>>({});
  const [leagueLogoUrl, setLeagueLogoUrl] = useState<string | null>(league.logoUrl);

  const activeTeams   = teams.filter((t) => t.isActive);
  const inactiveTeams = teams.filter((t) => !t.isActive);
  const navItems = NAV_KEYS.filter((n) => !n.adminOnly || isAdmin).map((n) => ({
    ...n,
    label: tl.nav[n.key as keyof typeof tl.nav] ?? n.key,
  }));

  async function toggleActive(team: Team) {
    const res = await fetch(`/api/leagues/${slug}/teams/${team.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !team.isActive }),
    });
    if (res.ok) router.refresh();
  }

  async function deleteTeam(team: Team) {
    setTeamError({});
    const res = await fetch(`/api/leagues/${slug}/teams/${team.id}`, { method: "DELETE" });
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json();
      setTeamError((prev) => ({ ...prev, [team.id]: data.error ?? "Cannot delete" }));
    }
  }

  async function toggleStatus(team: Team) {
    const next = team.status === "APPROVED" ? "PENDING" : "APPROVED";
    const res = await fetch(`/api/leagues/${slug}/teams/${team.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) router.refresh();
  }

  async function deleteField(fieldId: string) {
    const res = await fetch(`/api/leagues/${slug}/fields/${fieldId}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  // ── Sidebar ────────────────────────────────────────────────────────────────

  const Sidebar = (
    <nav className="flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-visible shrink-0 lg:w-44">
      {navItems.map((item) => (
        <button
          key={item.key}
          onClick={() => setSection(item.key)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all shrink-0"
          style={
            section === item.key
              ? { background: "#16a34a", color: "#fff" }
              : { color: "#4ade80", background: "transparent" }
          }
        >
          <span>{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );

  // ── Sections ───────────────────────────────────────────────────────────────

  const Overview = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold" style={head}>{tl.overview.title}</h2>
        {isAdmin && (
          <BroadcastDialog
            slug={slug}
            teams={teams.filter((t) => t.isActive).map((t) => ({
              id: t.id, name: t.name,
              manager:   t.manager   ? { id: t.manager.id,   name: t.manager.name,   email: t.manager.email }   : null,
              assistant: t.assistant ? { id: t.assistant.id, name: t.assistant.name, email: t.assistant.email } : null,
            }))}
            seasons={seasons.map((s) => ({ id: s.id, name: s.name }))}
            hasConditions={conditions.length > 0}
          />
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="col-span-2 sm:col-span-1 rounded-2xl border p-5" style={card}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={dim}>{tl.overview.info}</p>
          {(league.city || league.state) && (
            <p className="text-sm mb-1" style={muted}>📍 {[league.city, league.state].filter(Boolean).join(", ")}</p>
          )}
          <p className="text-sm mb-1" style={muted}>
            📋 {tl.overview.plan}: <span className="font-semibold" style={head}>{league.plan.name}</span>
          </p>
          <p className="text-sm mb-3" style={muted}>
            🔖 {tl.overview.status}:{" "}
            <span className="font-semibold capitalize" style={{
              color: league.status === "ACTIVE" ? "var(--sh-primary)" : league.status === "SUSPENDED" ? "var(--sh-danger)" : "var(--sh-inactive)",
            }}>
              {league.status === "ACTIVE" ? tl.overview.active : league.status === "SUSPENDED" ? tl.overview.suspended : tl.overview.archived}
            </span>
          </p>
          {isAdmin && (
            <div className="pt-3" style={{ borderTop: "1px solid var(--sh-border)" }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={dim}>League Logo</p>
              <LeagueLogoUpload
                slug={slug}
                leagueName={league.name}
                currentLogoUrl={leagueLogoUrl}
                onUpdated={(url) => setLeagueLogoUrl(url)}
              />
            </div>
          )}
        </div>
        {[
          { label: tl.overview.seasons,     value: seasons.length },
          { label: tl.overview.activeTeams, value: activeTeams.length },
          { label: tl.overview.categories,  value: categories.length },
          { label: tl.overview.fields,      value: fields.length },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border p-5 flex flex-col justify-between" style={card}>
            <p className="text-xs font-semibold uppercase tracking-wider" style={dim}>{stat.label}</p>
            <p className="text-4xl font-bold mt-2" style={muted}>{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );

  const Seasons = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold" style={head}>{tl.seasons.title}</h2>
        {isAdmin && <AddSeasonDialog slug={slug} />}
      </div>
      {seasons.length === 0 ? (
        <div className="rounded-2xl border py-10 text-center text-sm" style={{ ...card, color: "var(--sh-primary)" }}>
          {tl.seasons.none}{isAdmin && ` ${tl.seasons.noneHint}`}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {seasons.map((season) => {
            const badge = seasonBadge(season.status);
            return (
              <Link key={season.id} href={`/league/${slug}/season/${season.id}`} className="group block">
                <div className="rounded-xl border p-4 flex items-center justify-between transition-colors" style={card}>
                  <div>
                    <p className="font-semibold transition-colors" style={head}>{season.name}</p>
                    <p className="text-xs mt-0.5" style={dim}>
                      {new Date(season.startDate).toLocaleDateString()} – {new Date(season.endDate).toLocaleDateString()}
                    </p>
                    <p className="text-xs mt-1" style={muted}>{tl.seasons.view}</p>
                  </div>
                  <span className="text-xs font-semibold rounded-full px-3 py-1 shrink-0" style={{ background: badge.bg, color: badge.color }}>
                    {badge.text}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );

  const Categories = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold" style={head}>{tl.categories.title}</h2>
        {isAdmin && <AddCategoryDialog slug={slug} />}
      </div>
      {categories.length === 0 ? (
        <div className="rounded-2xl border py-10 text-center text-sm" style={{ ...card, color: "var(--sh-primary)" }}>
          {tl.categories.none}{isAdmin && ` ${tl.categories.noneHint}`}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <span key={cat.id} className="rounded-full border px-4 py-1.5 text-sm font-medium" style={{ borderColor: "#2d5a2d", background: "#1a3d1a", color: "#86efac" }}>
              {cat.name}{cat.description && <span style={{ color: "#4ade80", fontWeight: 400 }}> — {cat.description}</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );

  function TeamCard({ team, inactive }: { team: Team; inactive?: boolean }) {
    const isStaff = team.manager?.id === currentUserId || team.assistant?.id === currentUserId;
    const canEdit = isAdmin || (isStaff && team.status === "PENDING");
    const approved = team.status === "APPROVED";
    const [showPlayers, setShowPlayers] = useState(false);
    const [resending, setResending] = useState<string | null>(null);
    const [sentId,    setSentId]    = useState<string | null>(null);
    const [logoUrl,   setLogoUrl]   = useState<string | null>(team.logoUrl);

    async function resendInvite(playerId: string) {
      setResending(playerId);
      const res = await fetch(`/api/leagues/${slug}/players/${playerId}/resend-invite`, { method: "POST" });
      setResending(null);
      if (res.ok) {
        setSentId(playerId);
        setTimeout(() => setSentId((prev) => prev === playerId ? null : prev), 3000);
      }
    }

    return (
      <div className="rounded-xl border overflow-hidden" style={{ ...card, opacity: inactive ? 0.7 : 1 }}>

        {/* ── Header ── */}
        <div className="px-4 pt-4 pb-3" style={{ borderBottom: "1px solid #1e3a1e" }}>
          <div className="flex items-start justify-between gap-3">
            {/* Left: logo + name + badges */}
            <div className="flex items-start gap-3 min-w-0">
              <TeamAvatar name={team.name} logoUrl={logoUrl} size={12} />
              <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <span className="font-bold text-base" style={head}>{team.name}</span>
                {/* Status badge */}
                <span
                  className="text-xs font-semibold rounded-full px-2 py-0.5"
                  style={approved
                    ? { background: "var(--sh-approved-bg)", color: "var(--sh-primary)" }
                    : { background: "var(--sh-warn-bg)",     color: "var(--sh-warn)" }}
                >
                  {approved ? tl.teams.approved : tl.teams.pending}
                </span>
                {inactive && (
                  <span className="text-xs font-semibold rounded-full px-2 py-0.5" style={{ background: "var(--sh-inactive-bg)", color: "var(--sh-inactive)" }}>
                    {tl.teams.inactiveLabel}
                  </span>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                {team.season && (
                  <span className="text-xs rounded-full px-2.5 py-0.5 font-medium" style={{ background: "#1a3d1a", color: "#4ade80" }}>
                    📅 {team.season.name}
                  </span>
                )}
                {team.category && (
                  <span className="text-xs rounded-full px-2.5 py-0.5 font-medium" style={{ background: "#1e3a5f", color: "#93c5fd" }}>
                    🏷️ {team.category.name}
                  </span>
                )}
              </div>
            </div>
            </div>  {/* end logo+name flex */}

            {/* Right: action buttons */}
            {(isAdmin || isStaff) && (
              <div className="flex items-center gap-1.5 flex-wrap justify-end shrink-0">
                {!inactive && canEdit && (
                  <>
                    <EditTeamDialog
                      slug={slug}
                      team={team}
                      seasons={seasons.map((s) => ({ id: s.id, name: s.name }))}
                      categories={categories.map((c) => ({ id: c.id, name: c.name }))}
                    />
                    <AddPlayerDialog slug={slug} teamId={team.id} teamName={team.name} />
                    <UploadPlayersDialog slug={slug} teamId={team.id} teamName={team.name} />
                  </>
                )}
                {/* Approve / Unapprove — admin only */}
                {isAdmin && !inactive && (
                  <button
                    onClick={() => toggleStatus(team)}
                    className="text-xs px-2 py-1 rounded-md border transition-colors hover:opacity-80"
                    style={approved
                      ? { borderColor: "var(--sh-warn-bg)",  color: "var(--sh-warn)",    background: "transparent" }
                      : { borderColor: "var(--sh-border2)",  color: "var(--sh-primary)", background: "transparent" }}
                  >
                    {approved ? tl.teams.unapprove : tl.teams.approve}
                  </button>
                )}
                {isAdmin && (
                  <>
                    <button
                      onClick={() => toggleActive(team)}
                      className="text-xs px-2 py-1 rounded-md border transition-colors hover:opacity-80"
                      style={inactive
                        ? { borderColor: "var(--sh-border2)", color: "var(--sh-primary)", background: "transparent" }
                        : { borderColor: "var(--sh-muted)",   color: "var(--sh-inactive)", background: "transparent" }}
                    >
                      {inactive ? tl.teams.reactivate : tl.teams.deactivate}
                    </button>
                    {inactive && (
                      <button
                        onClick={() => deleteTeam(team)}
                        className="text-xs px-2 py-1 rounded-md border transition-colors hover:opacity-80"
                        style={{ borderColor: "var(--sh-danger-border)", color: "var(--sh-danger)", background: "transparent" }}
                      >
                        {tl.teams.delete}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Staff row */}
          {(team.manager || team.assistant) && (
            <div className="flex flex-wrap gap-x-6 gap-y-0.5 mt-2.5">
              {team.manager && (
                <p className="text-xs" style={dim}>
                  <span className="font-semibold" style={{ color: "var(--sh-primary)" }}>{tl.teams.managerLabel}</span>
                  {" · "}
                  <span style={head}>{team.manager.name ?? "—"}</span>
                  <span className="ml-1" style={dim}>{team.manager.email}</span>
                </p>
              )}
              {team.assistant && (
                <p className="text-xs" style={dim}>
                  <span className="font-semibold" style={{ color: "var(--sh-secondary)" }}>{tl.teams.assistantLabel}</span>
                  {" · "}
                  <span style={head}>{team.assistant.name ?? "—"}</span>
                  <span className="ml-1" style={dim}>{team.assistant.email}</span>
                </p>
              )}
            </div>
          )}

          {/* Logo upload — visible to managers and admins */}
          {canEdit && (
            <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--sh-border)" }}>
              <TeamLogoUpload
                slug={slug}
                teamId={team.id}
                teamName={team.name}
                currentLogoUrl={logoUrl}
                onUpdated={(url) => setLogoUrl(url)}
              />
            </div>
          )}

          {teamError[team.id] && (
            <p className="text-xs mt-2" style={{ color: "#f87171" }}>{teamError[team.id]}</p>
          )}
        </div>

        {/* ── Player roster toggle ── */}
        <button
          onClick={() => setShowPlayers((v) => !v)}
          className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-medium transition-colors hover:opacity-80"
          style={{ borderTop: "1px solid var(--sh-border)", color: "var(--sh-primary)", background: "transparent" }}
        >
          <span>
            {showPlayers ? tl.teams.hidePlayers : tl.teams.showPlayers}
            {team.players.length > 0 && (
              <span className="ml-1.5 rounded-full px-2 py-0.5 text-xs font-semibold"
                style={{ background: "var(--sh-bg-card2)", color: "var(--sh-secondary)" }}>
                {team.players.length}
              </span>
            )}
          </span>
          <span style={{ fontSize: "10px" }}>{showPlayers ? "▲" : "▼"}</span>
        </button>

        {/* ── Player roster ── */}
        {showPlayers && (team.players.length === 0 ? (
          <p className="px-4 py-3 text-xs" style={dim}>{tl.teams.noPlayers}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--sh-border)" }}>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider w-16" style={dim}>{tl.teams.photo}</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider w-12" style={dim}>{tl.teams.jersey}</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider" style={dim}>{tl.teams.name}</th>
                <th className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-wider w-16" style={dim}>{tl.teams.account}</th>
                {canEdit && <th className="px-4 py-2 w-16" />}
              </tr>
            </thead>
            <tbody>
              {team.players.map((p) => {
                const photo = playerPhotos[p.id] ?? p.photoUrl;
                return (
                  <tr key={p.id} style={{ borderBottom: "1px solid #0f2310" }}>
                    <td className="px-3 py-2">
                      <div className="flex flex-col items-center gap-1">
                        {/* Avatar — always visible */}
                        {photo ? (
                          <img
                            src={photo}
                            alt={p.name}
                            className="w-9 h-9 rounded-full object-cover"
                            style={{ border: "2px solid #2d5a2d" }}
                          />
                        ) : (
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
                            style={{ background: "#1a3d1a", color: "#4ade80", border: "2px solid #1e3a1e" }}
                          >
                            {p.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        {canEdit && (
                          <PlayerPhotoDialog
                            slug={slug}
                            playerId={p.id}
                            playerName={p.name}
                            currentPhotoUrl={photo}
                            onUpdated={(url) => setPlayerPhotos((prev) => ({ ...prev, [p.id]: url }))}
                          />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-center">
                      {p.jerseyNumber
                        ? <span className="text-xs font-bold" style={{ color: "#4ade80" }}>{p.jerseyNumber}</span>
                        : <span style={dim}>—</span>}
                    </td>
                    <td className="px-4 py-2 font-medium" style={head}>{p.name}</td>
                    <td className="px-4 py-2 text-center text-xs font-semibold" style={{ color: p.userId ? "#4ade80" : "#374151" }}>
                      {p.userId ? "✓" : "—"}
                    </td>
                    {canEdit && (
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <EditPlayerDialog slug={slug} player={p} />
                          {p.invitePending && (
                            <button
                              onClick={() => resendInvite(p.id)}
                              disabled={resending === p.id || sentId === p.id}
                              title="Resend invitation email"
                              className="text-xs px-2 py-1 rounded-md border transition-colors hover:opacity-80 disabled:opacity-50"
                              style={sentId === p.id
                                ? { borderColor: "var(--sh-primary)", color: "var(--sh-primary)", background: "transparent" }
                                : { borderColor: "var(--sh-border2)", color: "var(--sh-secondary)", background: "transparent" }}
                            >
                              {resending === p.id ? "Sending…" : sentId === p.id ? "✓ Sent" : "Resend invite"}
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        ))}
      </div>
    );
  }

  const Teams = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold" style={head}>{tl.teams.title}</h2>
        <div className="flex items-center gap-2">
          {inactiveTeams.length > 0 && (
            <button
              onClick={() => setShowInactive((v) => !v)}
              className="text-xs px-3 py-1.5 rounded-lg border transition-colors"
              style={{ borderColor: "var(--sh-border2)", color: showInactive ? "var(--sh-text)" : "var(--sh-primary)", background: showInactive ? "var(--sh-bg-card2)" : "transparent" }}
            >
              {showInactive ? tl.teams.hideInactive : tl.teams.showInactive} ({inactiveTeams.length})
            </button>
          )}
          {isAdmin && <AddTeamDialog slug={slug} seasons={seasons.map((s) => ({ id: s.id, name: s.name }))} categories={categories.map((c) => ({ id: c.id, name: c.name }))} />}
        </div>
      </div>

      {activeTeams.length === 0 && !showInactive ? (
        <div className="rounded-2xl border py-10 text-center text-sm" style={{ ...card, color: "var(--sh-primary)" }}>
          {tl.teams.none}{isAdmin && ` ${tl.teams.noneHint}`}
        </div>
      ) : (
        <div className="space-y-4">
          {activeTeams.map((team) => <TeamCard key={team.id} team={team} />)}
        </div>
      )}

      {showInactive && inactiveTeams.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider" style={dim}>{tl.teams.inactiveLabel}</p>
          <div className="space-y-4">
            {inactiveTeams.map((team) => <TeamCard key={team.id} team={team} inactive />)}
          </div>
        </div>
      )}
    </div>
  );

  const Members = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold" style={head}>{tl.members.title}</h2>
        <AddMemberDialog slug={slug} />
      </div>
      <div className="rounded-2xl border overflow-hidden" style={card}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--sh-border)" }}>
              {[tl.members.name, tl.members.email, tl.members.phone, tl.members.role, tl.members.verified, ""].map((h, i) => (
                <th key={i} className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider${i === 2 ? " hidden sm:table-cell" : ""}`} style={dim}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map((ur) => (
              <tr key={ur.id} style={{ borderBottom: "1px solid #0f2310" }}>
                <td className="px-4 py-3 font-medium" style={head}>{ur.user.name ?? "—"}</td>
                <td className="px-4 py-3" style={dim}>{ur.user.email}</td>
                <td className="px-4 py-3 hidden sm:table-cell" style={dim}>{ur.user.phone ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className="text-xs font-semibold rounded-full px-2.5 py-0.5" style={{ background: "#1a3d1a", color: "#4ade80" }}>
                    {roleLabel(ur.role)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {ur.user.emailVerified
                    ? <span className="text-xs font-semibold" style={muted}>✓ Verified</span>
                    : <ResendVerificationButton email={ur.user.email} />}
                </td>
                <td className="px-4 py-3">
                  <ResetPasswordButton slug={slug} userId={ur.user.id} tl={tl.members} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const FIELD_TYPE_LABELS: Record<string, string> = {
    MORNING: tl.fields.morning, AFTERNOON: tl.fields.afternoon, NIGHT: tl.fields.night,
  };

  const Fields = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold" style={head}>{tl.fields.title}</h2>
        {isAdmin && <AddFieldDialog slug={slug} />}
      </div>
      {fields.length === 0 ? (
        <div className="rounded-2xl border py-10 text-center text-sm" style={{ ...card, color: "var(--sh-primary)" }}>
          {tl.fields.none}{isAdmin && ` ${tl.fields.noneHint}`}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.id} className="rounded-xl border p-4 flex items-center justify-between" style={card}>
              <div>
                <p className="font-semibold" style={head}>{field.name}</p>
                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                  {field.types.length === 0
                    ? <span className="text-xs" style={dim}>{tl.fields.noTimeSlots}</span>
                    : field.types.map((ft) => {
                        const c = FIELD_TYPE_COLORS[ft] ?? { bg: "var(--sh-bg-card2)", color: "var(--sh-primary)" };
                        return (
                          <span key={ft} className="text-xs font-semibold rounded-full px-2.5 py-0.5" style={{ background: c.bg, color: c.color }}>
                            {FIELD_TYPE_LABELS[ft] ?? ft}
                          </span>
                        );
                      })}
                </div>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  <AddFieldDialog
                    slug={slug}
                    field={field}
                    trigger={
                      <button className="text-xs px-2 py-1 rounded-md border hover:opacity-80" style={{ borderColor: "var(--sh-border2)", color: "var(--sh-primary)", background: "transparent" }}>
                        {tl.fields.edit}
                      </button>
                    }
                  />
                  <button
                    onClick={() => deleteField(field.id)}
                    className="text-xs px-2 py-1 rounded-md border hover:opacity-80"
                    style={{ borderColor: "var(--sh-danger-border)", color: "var(--sh-danger)", background: "transparent" }}
                  >
                    {tl.fields.delete}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const CONTENT: Record<Section, React.ReactNode> = {
    overview:   Overview,
    seasons:    Seasons,
    categories: Categories,
    teams:      Teams,
    members:    Members,
    fields:     Fields,
    conditions: (
      <ConditionsSection
        slug={slug}
        isAdmin={isAdmin}
        conditions={conditions}
      />
    ),
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {Sidebar}
      <div className="flex-1 min-w-0">
        {CONTENT[section]}
      </div>
    </div>
  );
}
