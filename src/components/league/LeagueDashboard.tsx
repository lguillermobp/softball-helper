"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AddSeasonDialog } from "@/components/league/AddSeasonDialog";
import { AddCategoryDialog } from "@/components/league/AddCategoryDialog";
import { AddTeamDialog } from "@/components/league/AddTeamDialog";
import { EditTeamDialog } from "@/components/league/EditTeamDialog";
import { AddPlayerDialog } from "@/components/league/AddPlayerDialog";
import { AddMemberDialog } from "@/components/league/AddMemberDialog";
import { ResendVerificationButton } from "@/components/league/ResendVerificationButton";
import { AddFieldDialog } from "@/components/league/AddFieldDialog";

// ── Types ─────────────────────────────────────────────────────────────────────

type Section = "overview" | "seasons" | "categories" | "teams" | "members" | "fields";

interface Season { id: string; name: string; startDate: string; endDate: string; status: string }
interface Category { id: string; name: string; description: string | null }
interface Player { id: string; name: string; jerseyNumber: string | null; userId: string | null }
interface StaffMember { id: string; name: string | null; email: string; phone: string | null }
interface Team {
  id: string; name: string; isActive: boolean;
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
interface Field { id: string; name: string; types: string[] }

interface Props {
  slug: string;
  isAdmin: boolean;
  league: { id: string; name: string; city: string | null; state: string | null; status: string; plan: { name: string } };
  seasons: Season[];
  categories: Category[];
  teams: Team[];
  members: Member[];
  fields: Field[];
}

// ── Styles ────────────────────────────────────────────────────────────────────

const card = { borderColor: "#1e3a1e", background: "#0f2310" };
const dim = { color: "#6b7280" };
const muted = { color: "#4ade80" };
const head = { color: "#f0fdf4" };

function roleLabel(r: string) { return r.replace(/_/g, " "); }

function seasonBadge(s: string) {
  if (s === "ACTIVE")    return { bg: "#14532d", color: "#4ade80", text: "Active" };
  if (s === "COMPLETED") return { bg: "#1f2937", color: "#9ca3af", text: "Completed" };
  return { bg: "#78350f", color: "#fbbf24", text: "Upcoming" };
}

const FIELD_TYPE_LABELS: Record<string, string> = { MORNING: "Morning", AFTERNOON: "Afternoon", NIGHT: "Night" };
const FIELD_TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  MORNING:   { bg: "#78350f", color: "#fbbf24" },
  AFTERNOON: { bg: "#1e3a5f", color: "#93c5fd" },
  NIGHT:     { bg: "#1a1a3d", color: "#a78bfa" },
};

// ── Nav items ─────────────────────────────────────────────────────────────────

const NAV_ITEMS: { key: Section; label: string; icon: string; adminOnly?: boolean }[] = [
  { key: "overview",   label: "Overview",   icon: "⚾" },
  { key: "seasons",    label: "Seasons",    icon: "📅" },
  { key: "categories", label: "Categories", icon: "🏷️" },
  { key: "teams",      label: "Teams",      icon: "👥" },
  { key: "members",    label: "Members",    icon: "🙋", adminOnly: true },
  { key: "fields",     label: "Fields",     icon: "🏟️" },
];

// ── Main component ────────────────────────────────────────────────────────────

export function LeagueDashboard({ slug, isAdmin, league, seasons, categories, teams, members, fields }: Props) {
  const router = useRouter();
  const [section, setSection] = useState<Section>("overview");
  const [showInactive, setShowInactive] = useState(false);
  const [teamError, setTeamError] = useState<Record<string, string>>({});

  const activeTeams   = teams.filter((t) => t.isActive);
  const inactiveTeams = teams.filter((t) => !t.isActive);
  const navItems = NAV_ITEMS.filter((n) => !n.adminOnly || isAdmin);

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
      <h2 className="text-lg font-bold" style={head}>League Overview</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="col-span-2 sm:col-span-1 rounded-2xl border p-5" style={card}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={dim}>Info</p>
          {(league.city || league.state) && (
            <p className="text-sm mb-1" style={muted}>📍 {[league.city, league.state].filter(Boolean).join(", ")}</p>
          )}
          <p className="text-sm mb-1" style={muted}>
            📋 Plan: <span className="font-semibold" style={head}>{league.plan.name}</span>
          </p>
          <p className="text-sm" style={muted}>
            🔖 Status:{" "}
            <span className="font-semibold capitalize" style={{
              color: league.status === "ACTIVE" ? "#4ade80" : league.status === "SUSPENDED" ? "#f87171" : "#9ca3af",
            }}>
              {league.status.toLowerCase()}
            </span>
          </p>
        </div>
        {[
          { label: "Seasons",    value: seasons.length },
          { label: "Active Teams", value: activeTeams.length },
          { label: "Categories", value: categories.length },
          { label: "Fields",     value: fields.length },
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
        <h2 className="text-lg font-bold" style={head}>Seasons</h2>
        {isAdmin && <AddSeasonDialog slug={slug} />}
      </div>
      {seasons.length === 0 ? (
        <div className="rounded-2xl border py-10 text-center text-sm" style={{ ...card, color: "#4ade80" }}>
          No seasons yet.{isAdmin && " Click «+ Add season» to create one."}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {seasons.map((season) => {
            const badge = seasonBadge(season.status);
            return (
              <Link key={season.id} href={`/league/${slug}/season/${season.id}`} className="group block">
                <div className="rounded-xl border p-4 flex items-center justify-between transition-colors group-hover:border-[#4ade80]" style={card}>
                  <div>
                    <p className="font-semibold group-hover:text-green-300 transition-colors" style={head}>{season.name}</p>
                    <p className="text-xs mt-0.5" style={dim}>
                      {new Date(season.startDate).toLocaleDateString()} – {new Date(season.endDate).toLocaleDateString()}
                    </p>
                    <p className="text-xs mt-1" style={muted}>View schedule →</p>
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
        <h2 className="text-lg font-bold" style={head}>Categories</h2>
        {isAdmin && <AddCategoryDialog slug={slug} />}
      </div>
      {categories.length === 0 ? (
        <div className="rounded-2xl border py-10 text-center text-sm" style={{ ...card, color: "#4ade80" }}>
          No categories yet.{isAdmin && " Click «+ Add category» to create one."}
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
    return (
      <div className="rounded-xl border overflow-hidden" style={{ ...card, opacity: inactive ? 0.7 : 1 }}>

        {/* ── Header ── */}
        <div className="px-4 pt-4 pb-3" style={{ borderBottom: "1px solid #1e3a1e" }}>
          <div className="flex items-start justify-between gap-3">
            {/* Left: name + badges */}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <span className="font-bold text-base" style={head}>{team.name}</span>
                {inactive && (
                  <span className="text-xs font-semibold rounded-full px-2 py-0.5" style={{ background: "#78350f", color: "#fbbf24" }}>Inactive</span>
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

            {/* Right: action buttons */}
            {isAdmin && (
              <div className="flex items-center gap-1.5 flex-wrap justify-end shrink-0">
                {!inactive && (
                  <>
                    <EditTeamDialog
                      slug={slug}
                      team={team}
                      seasons={seasons.map((s) => ({ id: s.id, name: s.name }))}
                      categories={categories.map((c) => ({ id: c.id, name: c.name }))}
                    />
                    <AddPlayerDialog slug={slug} teamId={team.id} teamName={team.name} />
                  </>
                )}
                <button
                  onClick={() => toggleActive(team)}
                  className="text-xs px-2 py-1 rounded-md border transition-colors hover:opacity-80"
                  style={inactive
                    ? { borderColor: "#16a34a", color: "#4ade80", background: "transparent" }
                    : { borderColor: "#78350f", color: "#fbbf24", background: "transparent" }}
                >
                  {inactive ? "Reactivate" : "Deactivate"}
                </button>
                {inactive && (
                  <button
                    onClick={() => deleteTeam(team)}
                    className="text-xs px-2 py-1 rounded-md border transition-colors hover:opacity-80"
                    style={{ borderColor: "#3f1515", color: "#f87171", background: "transparent" }}
                  >
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Staff row */}
          {(team.manager || team.assistant) && (
            <div className="flex flex-wrap gap-x-6 gap-y-0.5 mt-2.5">
              {team.manager && (
                <p className="text-xs" style={dim}>
                  <span className="font-semibold" style={{ color: "#4ade80" }}>Manager</span>
                  {" · "}
                  <span style={head}>{team.manager.name ?? "—"}</span>
                  <span className="ml-1" style={dim}>{team.manager.email}</span>
                </p>
              )}
              {team.assistant && (
                <p className="text-xs" style={dim}>
                  <span className="font-semibold" style={{ color: "#86efac" }}>Assistant</span>
                  {" · "}
                  <span style={head}>{team.assistant.name ?? "—"}</span>
                  <span className="ml-1" style={dim}>{team.assistant.email}</span>
                </p>
              )}
            </div>
          )}

          {teamError[team.id] && (
            <p className="text-xs mt-2" style={{ color: "#f87171" }}>{teamError[team.id]}</p>
          )}
        </div>

        {/* ── Player roster ── */}
        {team.players.length === 0 ? (
          <p className="px-4 py-3 text-xs" style={dim}>No players yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid #1e3a1e" }}>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider w-12" style={dim}>#</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider" style={dim}>Name</th>
                <th className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-wider w-16" style={dim}>Account</th>
              </tr>
            </thead>
            <tbody>
              {team.players.map((p) => (
                <tr key={p.id} style={{ borderBottom: "1px solid #0f2310" }}>
                  <td className="px-4 py-2 text-center">
                    {p.jerseyNumber
                      ? <span className="text-xs font-bold" style={{ color: "#4ade80" }}>{p.jerseyNumber}</span>
                      : <span style={dim}>—</span>}
                  </td>
                  <td className="px-4 py-2 font-medium" style={head}>{p.name}</td>
                  <td className="px-4 py-2 text-center text-xs font-semibold" style={{ color: p.userId ? "#4ade80" : "#374151" }}>
                    {p.userId ? "✓" : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  const Teams = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold" style={head}>Teams</h2>
        <div className="flex items-center gap-2">
          {inactiveTeams.length > 0 && (
            <button
              onClick={() => setShowInactive((v) => !v)}
              className="text-xs px-3 py-1.5 rounded-lg border transition-colors"
              style={{ borderColor: "#2d5a2d", color: showInactive ? "#f0fdf4" : "#4ade80", background: showInactive ? "#1a3d1a" : "transparent" }}
            >
              {showInactive ? "Hide" : "Show"} inactive ({inactiveTeams.length})
            </button>
          )}
          {isAdmin && <AddTeamDialog slug={slug} seasons={seasons.map((s) => ({ id: s.id, name: s.name }))} categories={categories.map((c) => ({ id: c.id, name: c.name }))} />}
        </div>
      </div>

      {activeTeams.length === 0 && !showInactive ? (
        <div className="rounded-2xl border py-10 text-center text-sm" style={{ ...card, color: "#4ade80" }}>
          No active teams.{isAdmin && " Click «+ Add team» to add one."}
        </div>
      ) : (
        <div className="space-y-4">
          {activeTeams.map((team) => <TeamCard key={team.id} team={team} />)}
        </div>
      )}

      {showInactive && inactiveTeams.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider" style={dim}>Inactive</p>
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
        <h2 className="text-lg font-bold" style={head}>Members</h2>
        <AddMemberDialog slug={slug} />
      </div>
      <div className="rounded-2xl border overflow-hidden" style={card}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid #1e3a1e" }}>
              {["Name", "Email", "Phone", "Role", "Verified"].map((h) => (
                <th key={h} className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider${h === "Phone" ? " hidden sm:table-cell" : ""}`} style={dim}>{h}</th>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const Fields = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold" style={head}>Fields</h2>
        {isAdmin && <AddFieldDialog slug={slug} />}
      </div>
      {fields.length === 0 ? (
        <div className="rounded-2xl border py-10 text-center text-sm" style={{ ...card, color: "#4ade80" }}>
          No fields yet.{isAdmin && " Click «+ Add field» to add one."}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.id} className="rounded-xl border p-4 flex items-center justify-between" style={card}>
              <div>
                <p className="font-semibold" style={head}>{field.name}</p>
                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                  {field.types.length === 0
                    ? <span className="text-xs" style={dim}>No time slots set</span>
                    : field.types.map((t) => {
                        const c = FIELD_TYPE_COLORS[t] ?? { bg: "#1a3d1a", color: "#4ade80" };
                        return (
                          <span key={t} className="text-xs font-semibold rounded-full px-2.5 py-0.5" style={{ background: c.bg, color: c.color }}>
                            {FIELD_TYPE_LABELS[t] ?? t}
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
                      <button className="text-xs px-2 py-1 rounded-md border hover:opacity-80" style={{ borderColor: "#2d5a2d", color: "#4ade80", background: "transparent" }}>
                        Edit
                      </button>
                    }
                  />
                  <button
                    onClick={() => deleteField(field.id)}
                    className="text-xs px-2 py-1 rounded-md border hover:opacity-80"
                    style={{ borderColor: "#3f1515", color: "#f87171", background: "transparent" }}
                  >
                    Delete
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
    overview: Overview,
    seasons: Seasons,
    categories: Categories,
    teams: Teams,
    members: Members,
    fields: Fields,
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
