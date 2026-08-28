"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLanguage } from "@/context/language-context";
import Link from "next/link";
import { AddSeasonDialog } from "@/components/league/AddSeasonDialog";
import { AddCategoryDialog } from "@/components/league/AddCategoryDialog";
import { CategoryAgeRow } from "@/components/league/CategoryAgeRow";
import { ProspectsSection } from "@/components/league/ProspectsSection";
import { AddTeamDialog } from "@/components/league/AddTeamDialog";
import { EditTeamDialog } from "@/components/league/EditTeamDialog";
import { AddPlayerDialog } from "@/components/league/AddPlayerDialog";
import { MembersPanel } from "@/components/league/MembersPanel";
import { ResendVerificationButton } from "@/components/league/ResendVerificationButton";
import { AddFieldDialog } from "@/components/league/AddFieldDialog";
import { UploadPlayersDialog } from "@/components/league/UploadPlayersDialog";
import { PlayerPhotoDialog } from "@/components/league/PlayerPhotoDialog";
import { ConditionsSection } from "@/components/league/ConditionsSection";
import { EditPlayerDialog } from "@/components/league/EditPlayerDialog";
import { BroadcastDialog } from "@/components/league/BroadcastDialog";
import { TeamLogoUpload } from "@/components/league/TeamLogoUpload";
import { LeagueLogoUpload } from "@/components/league/LeagueLogoUpload";
import { LeagueBannerUpload } from "@/components/league/LeagueBannerUpload";
import { TeamAvatar } from "@/components/ui/TeamAvatar";
import { flagUrl } from "@/lib/countries";

// ── Types ─────────────────────────────────────────────────────────────────────

type Section = "overview" | "seasons" | "categories" | "prospects" | "teams" | "members" | "fields" | "conditions" | "public-page";

interface Season { id: string; name: string; startDate: string; endDate: string; status: string; ageCutoffDate: string | null }
interface Category { id: string; name: string; description: string | null; minAge: number | null; maxAge: number | null }
interface Player { id: string; name: string; email: string | null; jerseyNumber: string | null; nationality: string | null; photoUrl: string | null; dob: string | null; userId: string | null; invitePending: boolean }
interface StaffMember { id: string; name: string | null; email: string; phone: string | null }
interface PublicPageConfig {
  published: boolean;
  description: string | null;
  showStandings: boolean;
  showSchedule: boolean;
  showTeams: boolean;
  socialLinks: Record<string, string> | null;
}
interface TeamPublicPageConfig {
  published: boolean;
  description: string | null;
  showRoster: boolean;
  showStats: boolean;
  showSchedule: boolean;
  socialLinks: Record<string, string> | null;
}
interface TeamSeasonReg { seasonId: string; seasonName: string; categoryId: string | null; categoryName: string | null }
interface Team {
  id: string; name: string; logoUrl: string | null; status: string; isActive: boolean;
  seasons: TeamSeasonReg[];
  manager: StaffMember | null;
  assistant: StaffMember | null;
  players: Player[];
  publicPage: TeamPublicPageConfig | null;
  requireDob: boolean;
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
interface Field {
  id: string; name: string; types: string[];
  slotStartTime?: string | null; slotDurationMins?: number;
  slotsMonday?: number; slotsTuesday?: number; slotsWednesday?: number;
  slotsThursday?: number; slotsFriday?: number; slotsSaturday?: number; slotsSunday?: number;
  defaultScorekeeperUserId?: string | null;
  defaultUmpireUserId?: string | null;
}
interface Official { id: string; name: string | null; role: string }
interface Condition {
  id: string; title: string; content: string | null;
  fileUrl: string | null; fileName: string | null; fileType: string | null;
  order: number; createdAt: string;
  createdBy: { id: string; name: string | null; email: string };
}

interface TechnicianOption { id: string; name: string | null; email: string }

interface SubscriptionProp {
  effectiveStatus: "ACTIVE" | "EXPIRED" | "LIMIT_REACHED" | "NO_SUBSCRIPTION";
  gamesUsed: number;
  daysRemaining: number;
  plan: { name: string; price: number } | null;
  maxGames: number;
  startDate: string | null;
  endDate: string | null;
}

interface Props {
  slug: string;
  isAdmin: boolean;
  isCategoryAdmin?: boolean;
  isMasterAdmin?: boolean;
  currentUserId: string;
  league: { id: string; name: string; city: string | null; state: string | null; status: string; type: string; logoUrl: string | null; bannerUrl: string | null; plan: { name: string; stripePriceId: string | null }; stripeCustomerId: string | null; subscriptionStatus: string | null; notifyGameEnd: boolean; notifyEmail: string | null; notifyManagers: boolean; instagramEnabled: boolean; timezone: string; usesTryoutDraft: boolean };
  subscription?: SubscriptionProp | null;
  technician?: TechnicianOption | null;
  availableTechnicians?: TechnicianOption[];
  seasons: Season[];
  categories: Category[];
  teams: Team[];
  members: Member[];
  fields: Field[];
  officials?: Official[];
  conditions: Condition[];
  publicPage: PublicPageConfig | null;
}

// ── Styles (CSS variables — adapt to dark/light theme) ────────────────────────

const card  = { borderColor: "var(--sh-border)",    background: "var(--sh-bg-card)" };
const dim   = { color: "var(--sh-muted)" };
const muted = { color: "var(--sh-primary)" };
const head  = { color: "var(--sh-text)" };

function roleLabel(r: string) { return r.replace(/_/g, " "); }

function SubscriptionPanel({ slug, league, isAdmin }: {
  slug: string;
  league: { plan: { name: string; stripePriceId: string | null }; stripeCustomerId: string | null; subscriptionStatus: string | null };
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [error, setError]     = React.useState("");

  if (!isAdmin) return null;

  const status = league.subscriptionStatus;
  const hasCustomer = !!league.stripeCustomerId;
  const hasPriceId  = !!league.plan.stripePriceId;

  const statusColor = status === "active"   ? "#22c55e"
                    : status === "past_due"  ? "#f59e0b"
                    : status === "cancelled" ? "#ef4444"
                    : "var(--sh-muted)";

  async function handleSubscribe() {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leagueSlug: slug }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to start checkout"); return; }
      window.location.href = data.url;
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }

  async function handleManage() {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leagueSlug: slug }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to open billing portal"); return; }
      window.location.href = data.url;
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }

  return (
    <>
      {status && (
        <p className="text-sm mb-2" style={{ color: "var(--sh-text)" }}>
          Status: <span className="font-semibold capitalize" style={{ color: statusColor }}>{status.replace("_", " ")}</span>
        </p>
      )}
      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
      {hasCustomer ? (
        <button
          onClick={handleManage}
          disabled={loading}
          className="text-sm rounded-lg px-3 py-1.5 font-medium"
          style={{ background: "var(--sh-primary)", color: "#fff", opacity: loading ? 0.6 : 1 }}
        >
          {loading ? "Loading…" : "Manage billing"}
        </button>
      ) : hasPriceId ? (
        <button
          onClick={handleSubscribe}
          disabled={loading}
          className="text-sm rounded-lg px-3 py-1.5 font-medium"
          style={{ background: "var(--sh-primary)", color: "#fff", opacity: loading ? 0.6 : 1 }}
        >
          {loading ? "Loading…" : "Subscribe"}
        </button>
      ) : null}
    </>
  );
}

function AssignManagerInline({ slug, teamId }: { slug: string; teamId: string }) {
  const router = useRouter();
  const [open, setOpen]       = React.useState(false);
  const [saving, setSaving]   = React.useState(false);
  const [error, setError]     = React.useState("");
  const [plays, setPlays]     = React.useState(false);
  const [name, setName]       = React.useState("");
  const [email, setEmail]     = React.useState("");
  const [phone, setPhone]     = React.useState("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError("");
    const res = await fetch(`/api/leagues/${slug}/teams/${teamId}/set-manager`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone: phone || null, managerRole: plays ? "TEAM_MANAGER_PLAYER" : "TEAM_MANAGER" }),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error ?? "Failed"); return; }
    setOpen(false); router.refresh();
  }

  const inputCls = "rounded-lg border px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-green-500";
  const inputStyle = { borderColor: "var(--sh-border)", background: "var(--sh-bg-card2)", color: "var(--sh-text)" };

  if (!open) return (
    <button onClick={() => setOpen(true)} className="text-xs underline" style={{ color: "var(--sh-primary)" }}>
      + Assign manager
    </button>
  );

  return (
    <form onSubmit={handleSave} className="mt-1 space-y-2 w-full">
      <p className="text-xs font-semibold" style={{ color: "var(--sh-primary)" }}>Assign manager</p>
      <div className="flex flex-wrap gap-2">
        <input required value={name} onChange={e => setName(e.target.value)} placeholder="Full name" className={inputCls} style={inputStyle} />
        <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" className={inputCls} style={inputStyle} />
        <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone (optional)" className={inputCls} style={inputStyle} />
      </div>
      <label className="flex items-center gap-1.5 cursor-pointer select-none">
        <input type="checkbox" checked={plays} onChange={e => setPlays(e.target.checked)} className="accent-green-500 w-3.5 h-3.5" />
        <span className="text-xs" style={{ color: "var(--sh-secondary)" }}>Also plays (Manager-player)</span>
      </label>
      {error && <p className="text-xs" style={{ color: "var(--sh-danger)" }}>{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving}
          className="text-xs px-3 py-1.5 rounded-lg font-semibold disabled:opacity-50"
          style={{ background: "linear-gradient(135deg,#16a34a,#15803d)", color: "#fff" }}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={() => { setOpen(false); setError(""); }}
          className="text-xs px-3 py-1.5 rounded-lg border"
          style={{ borderColor: "var(--sh-border)", color: "var(--sh-muted)" }}>
          Cancel
        </button>
      </div>
    </form>
  );
}

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
const NAV_KEYS: { key: Section; icon: string; adminOnly?: boolean; tryoutOnly?: boolean }[] = [
  { key: "overview",    icon: "⚾" },
  { key: "seasons",     icon: "📅" },
  { key: "categories",  icon: "🏷️" },
  { key: "prospects",   icon: "⭐", tryoutOnly: true },
  { key: "teams",       icon: "👥" },
  { key: "members",     icon: "🙋", adminOnly: true },
  { key: "fields",      icon: "🏟️" },
  { key: "conditions",  icon: "📋" },
  { key: "public-page", icon: "🌐", adminOnly: true },
];

// ── Main component ────────────────────────────────────────────────────────────

export function LeagueDashboard({ slug, isAdmin, isCategoryAdmin = false, isMasterAdmin, currentUserId, league, subscription, technician: initialTechnician, availableTechnicians = [], seasons, categories, teams, members, fields, officials = [], conditions, publicPage: initialPublicPage }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stripeParam  = searchParams.get("stripe");
  const { t } = useLanguage();
  const tl = t.league;
  const [section, setSection] = useState<Section>("overview");
  const [showInactive, setShowInactive] = useState(false);
  const [teamError, setTeamError] = useState<Record<string, string>>({});
  const [playerPhotos, setPlayerPhotos] = useState<Record<string, string>>({});
  const [leagueLogoUrl,   setLeagueLogoUrl]   = useState<string | null>(league.logoUrl);
  const [leagueBannerUrl, setLeagueBannerUrl] = useState<string | null>(league.bannerUrl);
  const [technician, setTechnician]       = useState<TechnicianOption | null>(initialTechnician ?? null);
  const [selectedTechId, setSelectedTechId] = useState(initialTechnician?.id ?? "");
  const [savingTech, setSavingTech]       = useState(false);

  const [notifyOn,       setNotifyOn]       = useState(league.notifyGameEnd);
  const [notifyEmail,    setNotifyEmail]    = useState(league.notifyEmail ?? "");
  const [notifyManagers, setNotifyManagers] = useState(league.notifyManagers);
  const [igEnabled,      setIgEnabled]      = useState(league.instagramEnabled);
  const [timezone,       setTimezone]       = useState(league.timezone || "UTC");
  const [usesTryoutDraft, setUsesTryoutDraft] = useState(league.usesTryoutDraft);
  const [savingNotify,   setSavingNotify]   = useState(false);
  const [notifyMsg,      setNotifyMsg]      = useState<string | null>(null);
  const [leagueType,     setLeagueType]     = useState(league.type);
  const [typeSaving,     setTypeSaving]     = useState(false);
  const isSuspended = league.status === "SUSPENDED";

  const SPORTS: Record<string, { label: string; bg: string; icon: string }> = {
    SOFTBALL: { label: tl.overview.softball, bg: "/league-bg/softball.svg", icon: "🥎" },
    BASEBALL: { label: tl.overview.baseball, bg: "/league-bg/baseball.svg", icon: "⚾" },
    KICKBALL: { label: tl.overview.kickball, bg: "/league-bg/kickball.svg", icon: "⚽" },
  };
  const sport = SPORTS[leagueType] ?? SPORTS.SOFTBALL;

  async function saveType(next: string) {
    const prev = leagueType;
    setLeagueType(next);
    setTypeSaving(true);
    try {
      const res = await fetch(`/api/leagues/${slug}/type`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: next }),
      });
      if (!res.ok) setLeagueType(prev);
    } catch { setLeagueType(prev); }
    finally { setTypeSaving(false); }
  }

  async function saveNotifications() {
    setSavingNotify(true); setNotifyMsg(null);
    try {
      const res = await fetch(`/api/leagues/${slug}/notifications`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notifyGameEnd: notifyOn, notifyEmail, notifyManagers, instagramEnabled: igEnabled, timezone, usesTryoutDraft }),
      });
      const data = await res.json();
      if (!res.ok) { setNotifyMsg(data.error ?? "Failed to save"); return; }
      setNotifyOn(data.notifyGameEnd);
      setNotifyEmail(data.notifyEmail ?? "");
      setNotifyManagers(data.notifyManagers);
      setIgEnabled(data.instagramEnabled);
      setTimezone(data.timezone || "UTC");
      setUsesTryoutDraft(data.usesTryoutDraft);
      setNotifyMsg("Saved ✓");
      setTimeout(() => setNotifyMsg(null), 2500);
    } finally {
      setSavingNotify(false);
    }
  }

  async function saveTechnician() {
    setSavingTech(true);
    const res = await fetch(`/api/leagues/${slug}/set-technician`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ technicianId: selectedTechId || null }),
    });
    setSavingTech(false);
    if (res.ok) {
      const { technician: t } = await res.json();
      setTechnician(t ?? null);
    }
  }

  // ── Public page state ────────────────────────────────────────────────────────
  const [pp, setPp] = useState<PublicPageConfig>(initialPublicPage ?? {
    published: false, description: null,
    showStandings: true, showSchedule: true, showTeams: true, socialLinks: null,
  });
  const [ppSaving, setPpSaving] = useState(false);
  const [ppSaved,  setPpSaved]  = useState(false);
  const [teamPp, setTeamPp] = useState<Record<string, TeamPublicPageConfig>>(() =>
    Object.fromEntries(teams.map(t => [t.id, t.publicPage ?? { published: false, description: null, showRoster: true, showStats: true, showSchedule: true, socialLinks: null }]))
  );
  const [teamPpSaving, setTeamPpSaving] = useState<Record<string, boolean>>({});
  const [teamPpSaved,  setTeamPpSaved]  = useState<Record<string, boolean>>({});
  const [teamPpOpen,   setTeamPpOpen]   = useState<Record<string, boolean>>({});

  async function saveLeaguePp() {
    setPpSaving(true);
    const res = await fetch(`/api/leagues/${slug}/public-page`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pp) });
    setPpSaving(false);
    if (res.ok) { setPpSaved(true); setTimeout(() => setPpSaved(false), 2500); }
  }

  async function saveTeamPp(teamId: string) {
    setTeamPpSaving(p => ({ ...p, [teamId]: true }));
    await fetch(`/api/leagues/${slug}/teams/${teamId}/public-page`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(teamPp[teamId]) });
    setTeamPpSaving(p => ({ ...p, [teamId]: false }));
    setTeamPpSaved(p => ({ ...p, [teamId]: true }));
    setTimeout(() => setTeamPpSaved(p => ({ ...p, [teamId]: false })), 2500);
  }

  const activeTeams   = teams.filter((t) => t.isActive);
  const inactiveTeams = teams.filter((t) => !t.isActive);
  const navItems = NAV_KEYS
    .filter((n) => (!n.adminOnly || isAdmin) && (!n.tryoutOnly || (usesTryoutDraft && (isAdmin || isCategoryAdmin))))
    .map((n) => ({
      ...n,
      label: n.key === "prospects" ? "Prospects" : (tl.nav[n.key as keyof typeof tl.nav] ?? n.key),
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
        {isAdmin && !isSuspended && (
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

      {/* Sport hero banner with per-type background */}
      <div className="relative overflow-hidden rounded-2xl border" style={card}>
        <div className="absolute inset-0" aria-hidden style={{ backgroundImage: `url(${sport.bg})`, backgroundSize: "cover", backgroundPosition: "center right" }} />
        <div className="relative flex items-center gap-4 p-5 sm:p-6">
          {leagueLogoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={leagueLogoUrl} alt={league.name} className="w-14 h-14 rounded-xl object-cover shrink-0" style={{ border: "1px solid var(--sh-border2)" }} />
          )}
          <div>
            <h3 className="text-xl font-black leading-tight" style={head}>{league.name}</h3>
            <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold"
              style={{ background: "var(--sh-bg-card2)", color: "var(--sh-primary)", border: "1px solid var(--sh-border2)" }}>
              <span>{sport.icon}</span><span>{sport.label}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Top row: slim info card + stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="col-span-2 sm:col-span-1 rounded-2xl border p-5" style={card}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={dim}>{tl.overview.info}</p>
          {(league.city || league.state) && (
            <p className="text-sm mb-1" style={muted}>📍 {[league.city, league.state].filter(Boolean).join(", ")}</p>
          )}
          <p className="text-sm mb-1" style={muted}>
            📋 {tl.overview.plan}: <span className="font-semibold" style={head}>{league.plan.name}</span>
          </p>
          <p className="text-sm" style={muted}>
            🔖 {tl.overview.status}:{" "}
            <span className="font-semibold capitalize" style={{
              color: league.status === "ACTIVE" ? "var(--sh-primary)" : league.status === "SUSPENDED" ? "var(--sh-danger)" : "var(--sh-inactive)",
            }}>
              {league.status === "ACTIVE" ? tl.overview.active : league.status === "SUSPENDED" ? tl.overview.suspended : tl.overview.archived}
            </span>
          </p>
          <p className="text-sm mt-1 flex items-center gap-1" style={muted}>
            <span>{sport.icon} {tl.overview.sport}:</span>
            {isAdmin && !isSuspended ? (
              <select value={leagueType} onChange={(e) => saveType(e.target.value)} disabled={typeSaving}
                className="rounded border px-1.5 py-0.5 text-sm font-semibold outline-none disabled:opacity-50"
                style={{ background: "var(--sh-bg-card2)", borderColor: "var(--sh-border2)", color: "var(--sh-text)" }}>
                <option value="SOFTBALL">{tl.overview.softball}</option>
                <option value="BASEBALL">{tl.overview.baseball}</option>
                <option value="KICKBALL">{tl.overview.kickball}</option>
              </select>
            ) : (
              <span className="font-semibold" style={head}>{sport.label}</span>
            )}
            {typeSaving && <span className="text-xs" style={dim}>{tl.overview.saving}</span>}
          </p>
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

      {/* Admin settings cards */}
      {isAdmin && !isSuspended && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Branding */}
          <div className="rounded-2xl border p-5" style={card}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={dim}>🎨 Branding</p>
            <p className="text-xs font-semibold mb-2" style={{ color: "var(--sh-muted)" }}>League Logo</p>
            <LeagueLogoUpload
              slug={slug}
              leagueName={league.name}
              currentLogoUrl={leagueLogoUrl}
              onUpdated={(url) => setLeagueLogoUrl(url)}
            />
            <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--sh-border)" }}>
              <p className="text-xs font-semibold mb-2" style={{ color: "var(--sh-muted)" }}>League Banner</p>
              <LeagueBannerUpload
                slug={slug}
                currentBannerUrl={leagueBannerUrl}
                onUpdated={(url) => setLeagueBannerUrl(url)}
              />
            </div>
          </div>

          {/* Notifications */}
          <div className="rounded-2xl border p-5" style={card}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={dim}>📧 Notifications</p>
            <label className="flex items-center gap-2 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={notifyOn}
                onChange={e => setNotifyOn(e.target.checked)}
                className="w-4 h-4 accent-green-500"
              />
              <span className="text-sm" style={{ color: "var(--sh-text)" }}>Notify when a game ends</span>
            </label>
            {notifyOn && (
              <input
                type="email"
                placeholder="admin@softballhelper.com"
                value={notifyEmail}
                onChange={e => setNotifyEmail(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card2)", color: "var(--sh-text)" }}
              />
            )}
            <label className="flex items-center gap-2 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={notifyManagers}
                onChange={e => setNotifyManagers(e.target.checked)}
                className="w-4 h-4 accent-green-500"
              />
              <span className="text-sm" style={{ color: "var(--sh-text)" }}>Notify team managers &amp; assistants</span>
            </label>
            <div className="mb-3">
              <label className="block text-xs font-semibold mb-1" style={{ color: "var(--sh-muted)" }}>Timezone</label>
              <select
                value={timezone}
                onChange={e => setTimezone(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card2)", color: "var(--sh-text)" }}
              >
                <optgroup label="North America">
                  <option value="America/New_York">Eastern — New York, Miami, Toronto</option>
                  <option value="America/Chicago">Central — Chicago, Dallas, Mexico City</option>
                  <option value="America/Denver">Mountain — Denver, Phoenix</option>
                  <option value="America/Los_Angeles">Pacific — Los Angeles, Seattle, Vancouver</option>
                  <option value="America/Anchorage">Alaska</option>
                  <option value="Pacific/Honolulu">Hawaii</option>
                </optgroup>
                <optgroup label="Latin America">
                  <option value="America/Argentina/Buenos_Aires">Argentina — Buenos Aires</option>
                  <option value="America/Sao_Paulo">Brazil — São Paulo, Rio de Janeiro</option>
                  <option value="America/Santiago">Chile — Santiago</option>
                  <option value="America/Bogota">Colombia — Bogotá</option>
                  <option value="America/Lima">Peru — Lima</option>
                  <option value="America/Caracas">Venezuela — Caracas</option>
                  <option value="America/La_Paz">Bolivia — La Paz</option>
                  <option value="America/Asuncion">Paraguay — Asunción</option>
                  <option value="America/Montevideo">Uruguay — Montevideo</option>
                  <option value="America/Guayaquil">Ecuador — Guayaquil</option>
                  <option value="America/Panama">Panama City</option>
                  <option value="America/Costa_Rica">Costa Rica</option>
                  <option value="America/Guatemala">Guatemala</option>
                  <option value="America/Tegucigalpa">Honduras</option>
                  <option value="America/El_Salvador">El Salvador</option>
                  <option value="America/Managua">Nicaragua</option>
                  <option value="America/Santo_Domingo">Dominican Republic</option>
                  <option value="America/Puerto_Rico">Puerto Rico</option>
                  <option value="America/Havana">Cuba — Havana</option>
                </optgroup>
                <optgroup label="Europe">
                  <option value="Europe/London">London (GMT/BST)</option>
                  <option value="Europe/Madrid">Madrid, Barcelona</option>
                  <option value="Europe/Paris">Paris, Rome, Berlin</option>
                </optgroup>
                <option value="UTC">UTC</option>
              </select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={igEnabled}
                onChange={e => setIgEnabled(e.target.checked)}
                className="w-4 h-4 accent-green-500"
              />
              <span className="text-sm" style={{ color: "var(--sh-text)" }}>Allow posting to Instagram</span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={usesTryoutDraft}
                onChange={e => setUsesTryoutDraft(e.target.checked)}
                className="w-4 h-4 mt-0.5 accent-green-500"
              />
              <span className="text-sm" style={{ color: "var(--sh-text)" }}>
                Run this league with tryouts &amp; a draft
                <span className="block text-xs" style={{ color: "var(--sh-muted)" }}>
                  Adds prospect registration, tryouts and the draft. Categories then require an age range and seasons an age cutoff.
                </span>
              </span>
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={saveNotifications}
                disabled={savingNotify}
                className="text-xs px-3 py-1.5 rounded-lg font-semibold disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#16a34a,#15803d)", color: "#fff" }}
              >
                {savingNotify ? "Saving…" : "Save"}
              </button>
              {notifyMsg && <span className="text-xs" style={{ color: notifyMsg.includes("✓") ? "var(--sh-primary)" : "#f87171" }}>{notifyMsg}</span>}
            </div>
          </div>

          {/* Technician — master admin only */}
          {isMasterAdmin && (
            <div className="rounded-2xl border p-5" style={card}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={dim}>🎫 Support Technician</p>
              {technician ? (
                <p className="text-sm mb-2" style={{ color: "var(--sh-primary)" }}>
                  {technician.name ?? technician.email}
                </p>
              ) : (
                <p className="text-xs mb-2" style={{ color: "var(--sh-muted)" }}>None assigned</p>
              )}
              {availableTechnicians.length > 0 && (
                <div className="flex gap-2">
                  <select
                    value={selectedTechId}
                    onChange={e => setSelectedTechId(e.target.value)}
                    className="flex-1 px-2 py-1 rounded-lg border text-xs focus:outline-none"
                    style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card2)", color: "var(--sh-text)" }}
                  >
                    <option value="">— None —</option>
                    {availableTechnicians.map(t => (
                      <option key={t.id} value={t.id}>{t.name ?? t.email}</option>
                    ))}
                  </select>
                  <button
                    onClick={saveTechnician}
                    disabled={savingTech || selectedTechId === (technician?.id ?? "")}
                    className="text-xs px-3 py-1 rounded-lg font-semibold disabled:opacity-40"
                    style={{ background: "linear-gradient(135deg,#16a34a,#15803d)", color: "#fff" }}
                  >
                    {savingTech ? "…" : "Save"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Subscription */}
          <div className="rounded-2xl border p-5" style={card}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={dim}>📊 Subscription</p>
            {subscription ? (() => {
              const s = subscription;
              const statusColor = s.effectiveStatus === "ACTIVE" ? "#22c55e"
                                : s.effectiveStatus === "EXPIRED" ? "#ef4444"
                                : s.effectiveStatus === "LIMIT_REACHED" ? "#f59e0b"
                                : "var(--sh-muted)";
              const statusLabel = s.effectiveStatus === "ACTIVE" ? "Active"
                                : s.effectiveStatus === "EXPIRED" ? "Expired"
                                : s.effectiveStatus === "LIMIT_REACHED" ? "Limit Reached"
                                : "No Subscription";
              const pct = s.maxGames > 0 ? Math.min(100, Math.round((s.gamesUsed / s.maxGames) * 100)) : 0;
              const barColor = pct >= 100 ? "#ef4444" : pct >= 80 ? "#f59e0b" : "#22c55e";
              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold" style={{ color: "var(--sh-text)" }}>
                      {s.plan ? s.plan.name : "No Plan"}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: statusColor + "22", color: statusColor }}>
                      {statusLabel}
                    </span>
                  </div>
                  {s.maxGames > 0 && (
                    <div>
                      <div className="flex justify-between text-xs mb-1" style={{ color: "var(--sh-muted)" }}>
                        <span>Games used</span>
                        <span>{s.gamesUsed} / {s.maxGames}</span>
                      </div>
                      <div className="w-full rounded-full h-2" style={{ background: "var(--sh-border)" }}>
                        <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
                      </div>
                    </div>
                  )}
                  {s.endDate && (
                    <div className="flex items-center justify-between text-xs" style={{ color: "var(--sh-muted)" }}>
                      <span>Expires {new Date(s.endDate).toLocaleDateString()}</span>
                      {s.effectiveStatus === "ACTIVE" && (
                        <span style={{ color: s.daysRemaining <= 30 ? "#f59e0b" : "var(--sh-muted)" }}>
                          {s.daysRemaining} day{s.daysRemaining !== 1 ? "s" : ""} left
                        </span>
                      )}
                    </div>
                  )}
                  {s.plan && (
                    <p className="text-xs" style={{ color: "var(--sh-muted)" }}>
                      ${s.plan.price.toFixed(2)} / year
                    </p>
                  )}
                </div>
              );
            })() : (
              <p className="text-sm" style={{ color: "var(--sh-muted)" }}>No subscription data</p>
            )}
            <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--sh-border)" }}>
              <SubscriptionPanel slug={slug} league={league} isAdmin={isAdmin} />
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const Seasons = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold" style={head}>{tl.seasons.title}</h2>
        {isAdmin && !isSuspended && <AddSeasonDialog slug={slug} requireCutoff={usesTryoutDraft} />}
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
        {isAdmin && !isSuspended && <AddCategoryDialog slug={slug} requireAge={usesTryoutDraft} />}
      </div>
      {categories.length === 0 ? (
        <div className="rounded-2xl border py-10 text-center text-sm" style={{ ...card, color: "var(--sh-primary)" }}>
          {tl.categories.none}{isAdmin && ` ${tl.categories.noneHint}`}
        </div>
      ) : usesTryoutDraft ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {categories.map((cat) => (
            <CategoryAgeRow key={cat.id} cat={cat} slug={slug} canEdit={isAdmin && !isSuspended} />
          ))}
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
    const isManager = team.manager?.id === currentUserId;
    const canEdit = isAdmin || (isStaff && team.status === "PENDING");
    const canRemovePlayer = isAdmin || isManager;
    const approved = team.status === "APPROVED";
    const [showPlayers, setShowPlayers] = useState(false);
    const [resending,     setResending]     = useState<string | null>(null);
    const [sentId,        setSentId]        = useState<string | null>(null);
    const [logoUrl,       setLogoUrl]       = useState<string | null>(team.logoUrl);
    const [removingId,      setRemovingId]      = useState<string | null>(null);
    const [removedIds,      setRemovedIds]      = useState<Set<string>>(new Set());
    const [settingAsstId,   setSettingAsstId]   = useState<string | null>(null);
    const [enlargedPhoto,   setEnlargedPhoto]   = useState<{ url: string; name: string } | null>(null);
    const [igTeamPosting,   setIgTeamPosting]   = useState(false);
    const [igTeamResult,    setIgTeamResult]    = useState<"ok" | "error" | null>(null);

    async function postTeamToInstagram() {
      setIgTeamPosting(true); setIgTeamResult(null);
      try {
        const res = await fetch(`/api/leagues/${slug}/instagram/post`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "team", teamId: team.id }),
        });
        setIgTeamResult(res.ok ? "ok" : "error");
      } catch {
        setIgTeamResult("error");
      } finally {
        setIgTeamPosting(false);
      }
    }

    async function resendInvite(playerId: string) {
      setResending(playerId);
      const res = await fetch(`/api/leagues/${slug}/players/${playerId}/resend-invite`, { method: "POST" });
      setResending(null);
      if (res.ok) {
        setSentId(playerId);
        setTimeout(() => setSentId((prev) => prev === playerId ? null : prev), 3000);
      }
    }

    async function removePlayer(playerId: string) {
      if (removingId) return;
      setRemovingId(playerId);
      const res = await fetch(`/api/leagues/${slug}/players/${playerId}`, { method: "DELETE" });
      setRemovingId(null);
      if (res.ok) setRemovedIds((prev) => new Set(prev).add(playerId));
    }

    async function setAssistant(playerId: string) {
      if (settingAsstId) return;
      setSettingAsstId(playerId);
      await fetch(`/api/leagues/${slug}/teams/${team.id}/set-assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });
      setSettingAsstId(null);
      router.refresh();
    }

    function printRoster() {
      const activePlayers = team.players.filter((p) => !removedIds.has(p.id));

      const managerRecord = members.find(
        (m) => m.user.id === team.manager?.id &&
          (m.role === "TEAM_MANAGER" || m.role === "TEAM_MANAGER_PLAYER")
      );
      const managerRoleLabel = managerRecord?.role === "TEAM_MANAGER_PLAYER"
        ? "Manager-Player" : "Manager";

      const assistantRecord = members.find(
        (m) => m.user.id === team.assistant?.id &&
          (m.role === "TEAM_ASSISTANT" || m.role === "TEAM_ASSISTANT_PLAYER")
      );
      const assistantRoleLabel = assistantRecord?.role === "TEAM_ASSISTANT_PLAYER"
        ? "Assistant-Player" : "Assistant";

      const leagueLogo = leagueLogoUrl
        ? `<img src="${leagueLogoUrl}" style="width:80px;height:80px;object-fit:cover;border-radius:10px;border:1px solid #ddd;flex-shrink:0;" />`
        : `<div style="width:80px;height:80px;border-radius:10px;background:#166534;color:#4ade80;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:800;flex-shrink:0;">${league.name.charAt(0)}</div>`;

      const teamLogo = logoUrl
        ? `<img src="${logoUrl}" style="width:46px;height:46px;object-fit:cover;border-radius:7px;border:1px solid #ddd;flex-shrink:0;" />`
        : `<div style="width:46px;height:46px;border-radius:7px;background:#166534;color:#4ade80;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;flex-shrink:0;">${team.name.charAt(0)}</div>`;

      const playerCards = activePlayers.map((p) => {
        const photo = playerPhotos[p.id] ?? p.photoUrl;
        const avatar = photo
          ? `<img src="${photo}" style="width:52px;height:52px;border-radius:50%;object-fit:cover;border:2px solid #16a34a;flex-shrink:0;" />`
          : `<div style="width:52px;height:52px;border-radius:50%;background:#166534;color:#4ade80;border:2px solid #16a34a;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:19px;flex-shrink:0;">${p.name.charAt(0).toUpperCase()}</div>`;
        const flag = p.nationality
          ? `<img src="https://flagcdn.com/w40/${p.nationality.toLowerCase()}.png" style="width:16px;height:11px;object-fit:cover;border-radius:2px;margin-right:4px;vertical-align:middle;" />`
          : "";
        return `
          <div class="player-card">
            ${avatar}
            <div class="player-info">
              ${p.jerseyNumber ? `<div class="jersey">#${p.jerseyNumber}</div>` : ""}
              <div class="player-name">${flag}${p.name}</div>
            </div>
          </div>`;
      }).join("");

      const coachingRow = [
        team.manager   ? `<div><div class="coach-role">${managerRoleLabel}</div><div class="coach-name">${team.manager.name   ?? team.manager.email}</div></div>`   : "",
        team.assistant ? `<div><div class="coach-role">${assistantRoleLabel}</div><div class="coach-name">${team.assistant.name ?? team.assistant.email}</div></div>` : "",
      ].filter(Boolean).join(`<div class="divider"></div>`);

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
        <title>${team.name} — Roster</title>
        <style>
          @page {
            size: letter portrait;
            margin: 16mm 14mm;
          }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: sans-serif;
            color: #111;
            /* match the @page content area: letter 8.5in minus 2×14mm margins */
            width: 178mm;
            padding: 20px 24px;
          }
          @media print {
            body { padding: 0; }
          }

          .league-header {
            display: flex;
            align-items: center;
            gap: 18px;
            padding-bottom: 11px;
            border-bottom: 3px solid #16a34a;
            margin-bottom: 11px;
          }
          .team-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 12px;
          }
          .player-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 0 24px;
            margin-bottom: 14px;
          }
          .player-card {
            display: flex;
            align-items: center;
            gap: 9px;
            padding: 5px 0;
            border-bottom: 1px solid #eee;
            break-inside: avoid;
          }
          .player-info { min-width: 0; }
          .jersey { font-size: 10px; font-weight: 700; color: #16a34a; margin-bottom: 1px; }
          .player-name { font-size: 12px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .coaching {
            border-top: 2px solid #eee;
            padding-top: 11px;
            display: flex;
            align-items: flex-start;
            gap: 0;
          }
          .coach-role { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #888; margin-bottom: 2px; }
          .coach-name { font-size: 13px; font-weight: 600; }
          .divider { width: 1px; background: #ddd; margin: 0 20px; align-self: stretch; }
        </style>
      </head><body>

        <!-- League header -->
        <div class="league-header">
          ${leagueLogo}
          <div>
            <div style="font-size:22px;font-weight:800;line-height:1.1;">${league.name}</div>
            ${(() => { const cats = [...new Set(team.seasons.map((s) => s.categoryName).filter(Boolean))]; return cats.length ? `<div style="font-size:13px;color:#555;margin-top:4px;">${cats.join(", ")}</div>` : ""; })()}
          </div>
        </div>

        <!-- Team header -->
        <div class="team-header">
          ${teamLogo}
          <div>
            <div style="font-size:16px;font-weight:700;">${team.name}</div>
            <div style="font-size:11px;color:#888;margin-top:2px;">${activePlayers.length} player${activePlayers.length !== 1 ? "s" : ""}</div>
          </div>
        </div>

        <!-- Players: 2-column grid -->
        <div class="player-grid">${playerCards}</div>

        <!-- Coaching staff -->
        ${coachingRow ? `<div class="coaching">${coachingRow}</div>` : ""}

      </body></html>`;

      const w = window.open("", "_blank", "width=820,height=1060");
      if (!w) return;
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(() => { w.print(); }, 400);
    }

    return (
      <div className="rounded-xl border overflow-hidden" style={{ ...card, opacity: inactive ? 0.7 : 1 }}>

        {/* ── Header ── */}
        <div className="px-4 pt-4 pb-3" style={{ borderBottom: "1px solid #1e3a1e" }}>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
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
                {team.seasons.length === 0 && (
                  <span className="text-xs" style={{ color: "var(--sh-inactive)" }}>{tl.teams.noSeason}</span>
                )}
                {team.seasons.map((reg) => (
                  <Link
                    key={reg.seasonId}
                    href={`/league/${slug}/season/${reg.seasonId}/team/${team.id}/stats`}
                    title={tl.teams.viewStats}
                    className="text-xs rounded-full px-2.5 py-0.5 font-medium inline-flex items-center gap-1 transition-opacity hover:opacity-80"
                    style={{ background: "#1a3d1a", color: "#4ade80" }}
                  >
                    📅 {reg.seasonName}{reg.categoryName ? ` · 🏷️ ${reg.categoryName}` : ""}
                  </Link>
                ))}
              </div>
            </div>
            </div>  {/* end logo+name flex */}

            {/* Right: action buttons */}
            {(isAdmin || isStaff) && (
              <div className="flex items-center gap-1.5 flex-wrap sm:justify-end sm:shrink-0">
            {(isAdmin || isStaff) && (
              <>
                <button
                  onClick={printRoster}
                  title="Print team roster"
                  className="text-xs px-2 py-1 rounded-md border transition-colors hover:opacity-80"
                  style={{ borderColor: "var(--sh-border2)", color: "var(--sh-muted)", background: "transparent" }}
                >
                  🖨 Roster
                </button>
                {igEnabled && (isAdmin || isStaff) && (
                  <button
                    onClick={postTeamToInstagram}
                    disabled={igTeamPosting}
                    title="Post team roster to Instagram"
                    className="text-xs px-2 py-1 rounded-md border transition-colors hover:opacity-80 disabled:opacity-50"
                    style={igTeamResult === "ok"
                      ? { borderColor: "var(--sh-primary)", color: "var(--sh-primary)", background: "transparent" }
                      : igTeamResult === "error"
                      ? { borderColor: "var(--sh-danger-border)", color: "var(--sh-danger)", background: "transparent" }
                      : { borderColor: "#833ab4", color: "#c084fc", background: "transparent" }}
                  >
                    {igTeamPosting ? "Posting..." : igTeamResult === "ok" ? "Posted!" : igTeamResult === "error" ? "Failed" : "IG Roster"}
                  </button>
                )}
                {!inactive && canEdit && !isSuspended && (
                  <>
                    <EditTeamDialog
                      slug={slug}
                      team={team}
                      managerRole={members.find(m => m.user.id === team.manager?.id &&
                        (m.role === "TEAM_MANAGER" || m.role === "TEAM_MANAGER_PLAYER"))?.role}
                      assistantRole={members.find(m => m.user.id === team.assistant?.id &&
                        (m.role === "TEAM_ASSISTANT" || m.role === "TEAM_ASSISTANT_PLAYER"))?.role}
                    />
                    <AddPlayerDialog slug={slug} teamId={team.id} teamName={team.name} requireDob={team.requireDob} />
                    <UploadPlayersDialog slug={slug} teamId={team.id} teamName={team.name} requireDob={team.requireDob} />
                  </>
                )}
                {/* Approve / Unapprove — admin only */}
                {isAdmin && !inactive && !isSuspended && (
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
                {isAdmin && !isSuspended && (
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
              </>
            )}
              </div>
            )}
          </div>

          {/* Staff row */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-x-6 gap-y-1 mt-2.5">
            {team.manager ? (
              <p className="text-xs min-w-0" style={dim}>
                <span className="font-semibold" style={{ color: "var(--sh-primary)" }}>{tl.teams.managerLabel}</span>
                {" · "}
                <span style={head}>{team.manager.name ?? "—"}</span>
                <span className="ml-1 break-all" style={dim}>{team.manager.email}</span>
              </p>
            ) : isAdmin && !isSuspended && (
              <AssignManagerInline slug={slug} teamId={team.id} />
            )}
            {team.assistant && (
              <p className="text-xs min-w-0" style={dim}>
                <span className="font-semibold" style={{ color: "var(--sh-secondary)" }}>{tl.teams.assistantLabel}</span>
                {" · "}
                <span style={head}>{team.assistant.name ?? "—"}</span>
                <span className="ml-1 break-all" style={dim}>{team.assistant.email}</span>
              </p>
            )}
          </div>

          {/* Logo upload — visible to managers and admins */}
          {canEdit && !isSuspended && (
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

          {/* ── Public page inline ── */}
          {(isAdmin || isStaff) && (() => {
            const tpp = teamPp[team.id] ?? { published: false, description: null, showRoster: true, showStats: true, showSchedule: true, socialLinks: null };
            const isOpen = !!teamPpOpen[team.id];
            const teamPublicUrl = typeof window !== "undefined" ? `${window.location.origin}/league/${slug}/team/${team.id}/public` : `/league/${slug}/team/${team.id}/public`;
            return (
              <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--sh-border)" }}>
                <button
                  onClick={() => setTeamPpOpen(p => ({ ...p, [team.id]: !p[team.id] }))}
                  className="flex items-center justify-between w-full text-left"
                >
                  <span className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: "var(--sh-muted)" }}>
                    🌐 Public page
                    <span className="font-normal normal-case" style={{ color: tpp.published ? "var(--sh-primary)" : "var(--sh-muted)", opacity: tpp.published ? 1 : 0.6 }}>
                      {tpp.published ? "● Published" : "○ Off"}
                    </span>
                  </span>
                  <span style={{ color: "var(--sh-muted)", fontSize: 10 }}>{isOpen ? "▲" : "▼"}</span>
                </button>

                {isOpen && (
                  <div className="mt-3 space-y-3">
                    {/* Published + URL */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <button
                        onClick={() => setTeamPp(p => ({ ...p, [team.id]: { ...tpp, published: !tpp.published } }))}
                        className="text-xs px-3 py-1 rounded-full border font-bold"
                        style={tpp.published
                          ? { borderColor: "#16a34a", color: "#4ade80", background: "#14532d" }
                          : { borderColor: "var(--sh-border2)", color: "var(--sh-muted)", background: "transparent" }}
                      >
                        {tpp.published ? "Published" : "Unpublished"}
                      </button>
                      {tpp.published && (
                        <div className="flex items-center gap-2">
                          <a href={`/league/${slug}/team/${team.id}/public`} target="_blank" className="text-xs hover:underline" style={{ color: "var(--sh-primary)" }}>View ↗</a>
                          <button onClick={() => navigator.clipboard.writeText(teamPublicUrl)} className="text-xs px-2 py-0.5 rounded border" style={{ borderColor: "var(--sh-border2)", color: "var(--sh-muted)", background: "transparent" }}>Copy</button>
                        </div>
                      )}
                    </div>

                    {/* Section toggles */}
                    <div className="space-y-2">
                      {([["showRoster", "👕 Roster"], ["showStats", "📊 Stats"], ["showSchedule", "📅 Schedule"]] as [keyof TeamPublicPageConfig, string][]).map(([key, label]) => (
                        <div key={key} className="flex items-center justify-between">
                          <span className="text-xs" style={{ color: "var(--sh-muted)" }}>{label}</span>
                          <button
                            onClick={() => setTeamPp(p => ({ ...p, [team.id]: { ...tpp, [key]: !tpp[key] } }))}
                            className="text-xs px-2.5 py-0.5 rounded-full border font-semibold"
                            style={(tpp[key] as boolean)
                              ? { borderColor: "#16a34a", color: "#4ade80", background: "#14532d" }
                              : { borderColor: "var(--sh-border2)", color: "var(--sh-muted)", background: "transparent" }}
                          >
                            {(tpp[key] as boolean) ? "On" : "Off"}
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Description */}
                    <textarea
                      value={tpp.description ?? ""}
                      onChange={e => setTeamPp(p => ({ ...p, [team.id]: { ...tpp, description: e.target.value || null } }))}
                      rows={2}
                      placeholder="Short description for the public page…"
                      className="w-full rounded-lg border px-3 py-2 text-xs resize-none outline-none focus:ring-1 focus:ring-green-500"
                      style={{ background: "var(--sh-bg-card2)", borderColor: "var(--sh-border)", color: "var(--sh-text)" }}
                    />

                    {/* Save */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => saveTeamPp(team.id)}
                        disabled={!!teamPpSaving[team.id] || isSuspended}
                        className="text-xs px-4 py-1.5 rounded-lg font-bold disabled:opacity-40"
                        style={{ background: "linear-gradient(135deg,#16a34a,#15803d)", color: "#fff" }}
                      >
                        {teamPpSaving[team.id] ? "Saving…" : "Save"}
                      </button>
                      {teamPpSaved[team.id] && <span className="text-xs" style={{ color: "var(--sh-primary)" }}>✓ Saved</span>}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
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
        {showPlayers && (() => {
          const visiblePlayers = team.players.filter((p) => !removedIds.has(p.id));
          return visiblePlayers.length === 0 ? (
          <p className="px-4 py-3 text-xs" style={dim}>{tl.teams.noPlayers}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--sh-border)" }}>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider w-16" style={dim}>{tl.teams.photo}</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider w-12" style={dim}>{tl.teams.jersey}</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider" style={dim}>{tl.teams.name}</th>
                <th className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-wider w-28" style={dim}>DOB / Age</th>
                <th className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-wider w-16" style={dim}>{tl.teams.account}</th>
                {(canEdit || canRemovePlayer) && <th className="px-4 py-2 w-16" />}
              </tr>
            </thead>
            <tbody>
              {visiblePlayers.map((p) => {
                const photo = playerPhotos[p.id] ?? p.photoUrl;
                return (
                  <tr key={p.id} style={{ borderBottom: "1px solid #0f2310" }}>
                    <td className="px-3 py-2">
                      <div className="flex flex-col items-center gap-1">
                        {/* Avatar — always visible */}
                        {photo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={photo}
                            alt={p.name}
                            className="w-9 h-9 rounded-full object-cover cursor-zoom-in"
                            style={{ border: "2px solid #2d5a2d" }}
                            onClick={() => setEnlargedPhoto({ url: photo, name: p.name })}
                          />
                        ) : (
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
                            style={{ background: "#1a3d1a", color: "#4ade80", border: "2px solid #1e3a1e" }}
                          >
                            {p.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        {canEdit && !isSuspended && (
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
                    <td className="px-4 py-2 font-medium" style={head}>
                      <span className="flex items-center gap-1.5">
                        {p.nationality && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={flagUrl(p.nationality)} alt={p.nationality} className="w-5 shrink-0" style={{ height: "14px", objectFit: "cover", borderRadius: "2px" }} />
                        )}
                        {p.name}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      {p.dob ? (() => {
                        const d = new Date(p.dob + "T12:00:00");
                        const age = Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
                        return (
                          <span className="text-xs" style={{ color: "var(--sh-secondary)" }}>
                            {d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                            <span className="ml-1 font-semibold" style={{ color: "var(--sh-primary)" }}>· {age}y</span>
                          </span>
                        );
                      })() : <span style={dim}>—</span>}
                    </td>
                    <td className="px-4 py-2 text-center text-xs font-semibold" style={{ color: p.userId ? "#4ade80" : "#374151" }}>
                      {p.userId ? "✓" : "—"}
                    </td>
                    {(canEdit || canRemovePlayer) && (
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {canEdit && !isSuspended && <EditPlayerDialog slug={slug} player={p} requireDob={team.requireDob} />}
                          {canEdit && !isSuspended && p.invitePending && (
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
                          {(isAdmin || isManager) && !isSuspended && p.userId !== team.manager?.id && (
                            p.userId === team.assistant?.id ? (
                              <span className="text-xs px-2 py-1 rounded-md border" style={{ borderColor: "var(--sh-border)", color: "var(--sh-muted)", opacity: 0.5 }}>
                                Asst.
                              </span>
                            ) : (
                              <button
                                onClick={() => setAssistant(p.id)}
                                disabled={!p.userId || settingAsstId === p.id}
                                title={!p.userId ? "Player needs a linked account first" : "Set as assistant"}
                                className="text-xs px-2 py-1 rounded-md border transition-colors hover:opacity-80 disabled:opacity-50"
                                style={{ borderColor: "var(--sh-border2)", color: "#818cf8", background: "transparent" }}
                              >
                                {settingAsstId === p.id ? "…" : "Set Asst."}
                              </button>
                            )
                          )}
                          {canRemovePlayer && !isSuspended && (
                            <button
                              onClick={() => removePlayer(p.id)}
                              disabled={removingId === p.id}
                              title="Remove player from roster"
                              className="text-xs px-2 py-1 rounded-md border transition-colors hover:opacity-80 disabled:opacity-50"
                              style={{ borderColor: "#7f1d1d", color: "#f87171", background: "transparent" }}
                            >
                              {removingId === p.id ? "…" : "Remove"}
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
        );
        })()}

      {/* Photo lightbox */}
      {enlargedPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.85)" }}
          onClick={() => setEnlargedPhoto(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={enlargedPhoto.url}
            alt={enlargedPhoto.name}
            className="rounded-2xl object-contain shadow-2xl"
            style={{ maxHeight: "80vh", maxWidth: "80vw" }}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setEnlargedPhoto(null)}
            className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center text-lg font-bold transition-opacity hover:opacity-80"
            style={{ background: "rgba(255,255,255,0.15)", color: "#fff" }}
          >
            ✕
          </button>
        </div>
      )}
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
          {isAdmin && !isSuspended && <AddTeamDialog slug={slug} />}
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

  const Members = <MembersPanel slug={slug} members={members} />;

  const FIELD_TYPE_LABELS: Record<string, string> = {
    MORNING: tl.fields.morning, AFTERNOON: tl.fields.afternoon, NIGHT: tl.fields.night,
  };

  const Fields = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold" style={head}>{tl.fields.title}</h2>
        {isAdmin && !isSuspended && <AddFieldDialog slug={slug} officials={officials} />}
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
              {isAdmin && !isSuspended && (
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  <AddFieldDialog
                    slug={slug}
                    field={field}
                    officials={officials}
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

  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/league/${slug}/public` : `/league/${slug}/public`;

  const PublicPageSection = (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold" style={{ color: "var(--sh-text)" }}>🌐 Public page</h2>
        <p className="text-sm mt-1" style={{ color: "var(--sh-muted)" }}>
          Configure what visitors see at your public league page. No login required.
        </p>
      </div>

      {/* Published toggle + URL */}
      <div className="rounded-2xl border p-4 space-y-3" style={card}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="font-semibold text-sm" style={{ color: "var(--sh-text)" }}>Published</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--sh-muted)" }}>
              When off, the page returns 404.
            </p>
          </div>
          <button
            onClick={() => setPp(p => ({ ...p, published: !p.published }))}
            className="text-xs px-4 py-1.5 rounded-full font-bold border transition-colors"
            style={pp.published
              ? { borderColor: "#16a34a", color: "#4ade80", background: "#14532d" }
              : { borderColor: "var(--sh-border2)", color: "var(--sh-muted)", background: "transparent" }}
          >
            {pp.published ? "● Published" : "○ Unpublished"}
          </button>
        </div>
        {pp.published && (
          <div className="flex items-center gap-2 flex-wrap">
            <a href={`/league/${slug}/public`} target="_blank" className="text-xs font-medium hover:underline truncate" style={{ color: "var(--sh-primary)" }}>
              /league/{slug}/public ↗
            </a>
            <button
              onClick={() => navigator.clipboard.writeText(publicUrl)}
              className="text-xs px-2 py-0.5 rounded border shrink-0"
              style={{ borderColor: "var(--sh-border2)", color: "var(--sh-muted)", background: "transparent" }}
            >
              Copy link
            </button>
          </div>
        )}
      </div>

      {/* Description */}
      <div className="rounded-2xl border p-4 space-y-2" style={card}>
        <p className="font-semibold text-sm" style={{ color: "var(--sh-text)" }}>Description</p>
        <textarea
          value={pp.description ?? ""}
          onChange={e => setPp(p => ({ ...p, description: e.target.value || null }))}
          rows={3}
          placeholder="A short description shown on your public page…"
          className="w-full rounded-lg border px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-green-500"
          style={{ background: "var(--sh-bg-card2)", borderColor: "var(--sh-border)", color: "var(--sh-text)" }}
        />
      </div>

      {/* Section toggles */}
      <div className="rounded-2xl border p-4 space-y-3" style={card}>
        <p className="font-semibold text-sm" style={{ color: "var(--sh-text)" }}>Sections</p>
        {([
          ["showStandings", "🏆 Standings"],
          ["showSchedule",  "📅 Schedule"],
          ["showTeams",     "👥 Teams"],
        ] as [keyof PublicPageConfig, string][]).map(([key, label]) => (
          <div key={key} className="flex items-center justify-between">
            <span className="text-sm" style={{ color: "var(--sh-muted)" }}>{label}</span>
            <button
              onClick={() => setPp(p => ({ ...p, [key]: !p[key] }))}
              className="text-xs px-3 py-1 rounded-full border font-semibold"
              style={(pp[key] as boolean)
                ? { borderColor: "#16a34a", color: "#4ade80", background: "#14532d" }
                : { borderColor: "var(--sh-border2)", color: "var(--sh-muted)", background: "transparent" }}
            >
              {(pp[key] as boolean) ? "On" : "Off"}
            </button>
          </div>
        ))}
      </div>

      {/* Social links */}
      <div className="rounded-2xl border p-4 space-y-3" style={card}>
        <p className="font-semibold text-sm" style={{ color: "var(--sh-text)" }}>Social links</p>
        {(["instagram", "facebook", "whatsapp", "twitter"] as const).map(net => (
          <div key={net} className="flex items-center gap-2">
            <span className="text-sm w-24 shrink-0" style={{ color: "var(--sh-muted)" }}>
              {net === "instagram" ? "📸" : net === "facebook" ? "📘" : net === "whatsapp" ? "💬" : "𝕏"} {net.charAt(0).toUpperCase() + net.slice(1)}
            </span>
            <input
              type="url"
              value={(pp.socialLinks?.[net] ?? "")}
              onChange={e => setPp(p => ({ ...p, socialLinks: { ...(p.socialLinks ?? {}), [net]: e.target.value || "" } }))}
              placeholder={`https://${net}.com/…`}
              className="flex-1 rounded-lg border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-green-500"
              style={{ background: "var(--sh-bg-card2)", borderColor: "var(--sh-border)", color: "var(--sh-text)" }}
            />
          </div>
        ))}
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={saveLeaguePp}
          disabled={ppSaving || isSuspended}
          className="px-5 py-2 rounded-xl text-sm font-bold disabled:opacity-40"
          style={{ background: "linear-gradient(135deg,#16a34a,#15803d)", color: "#fff" }}
        >
          {ppSaving ? "Saving…" : "Save"}
        </button>
        {ppSaved && <span className="text-sm" style={{ color: "var(--sh-primary)" }}>✓ Saved</span>}
      </div>
    </div>
  );

  const CONTENT: Record<Section, React.ReactNode> = {
    overview:    Overview,
    seasons:     Seasons,
    categories:  Categories,
    prospects:   <ProspectsSection slug={slug} seasons={seasons} categories={categories} canManage={isAdmin || isCategoryAdmin} isSuspended={isSuspended} />,
    teams:       Teams,
    members:     Members,
    fields:      Fields,
    conditions: (
      <ConditionsSection
        slug={slug}
        isAdmin={isAdmin && !isSuspended}
        conditions={conditions}
      />
    ),
    "public-page": PublicPageSection,
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {Sidebar}
      <div className="flex-1 min-w-0">
        {league.status === "SUSPENDED" && (
          <div className="mb-4 rounded-xl border px-4 py-3 text-sm font-medium flex items-center gap-2"
            style={{ background: "#450a0a", color: "#fca5a5", borderColor: "#ef4444" }}>
            <span>⚠️</span>
            <span>
              This league is currently <strong>suspended</strong> by a system administrator.
              Some features may be restricted. Contact support for more information.
            </span>
          </div>
        )}
        {stripeParam === "success" && (
          <div className="mb-4 rounded-xl border px-4 py-3 text-sm font-medium" style={{ background: "#14532d", color: "#86efac", borderColor: "#16a34a" }}>
            Subscription activated. Your league is now on the paid plan.
          </div>
        )}
        {stripeParam === "cancelled" && (
          <div className="mb-4 rounded-xl border px-4 py-3 text-sm" style={{ background: "#1c1917", color: "#a8a29e", borderColor: "#44403c" }}>
            Checkout was cancelled. You can subscribe anytime from the Overview tab.
          </div>
        )}
        {CONTENT[section]}
      </div>
    </div>
  );
}
