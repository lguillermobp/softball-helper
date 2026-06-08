"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/context/language-context";
import { EditGameDialog } from "@/components/league/EditGameDialog";
import { AddGameDialog } from "@/components/league/AddGameDialog";
import { RescheduleGameDialog } from "@/components/league/RescheduleGameDialog";
import { ScheduleGeneratorDialog } from "@/components/league/ScheduleGeneratorDialog";
import { TeamAvatar } from "@/components/ui/TeamAvatar";
import { flagUrl } from "@/lib/countries";
import type { OfficialBatterStat, OfficialPitcherStat } from "@/lib/stats";

interface Team { id: string; name: string; group: string | null; logoUrl?: string | null }
interface Category { id: string; name: string }
interface Field {
  id: string; name: string;
  slotStartTime: string | null; slotDurationMins: number;
  slotsMonday: number; slotsTuesday: number; slotsWednesday: number;
  slotsThursday: number; slotsFriday: number; slotsSaturday: number; slotsSunday: number;
}
interface Game {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  fieldId: string | null;
  categoryId: string | null;
  scheduledAt: string;
  homeAwayTbd: boolean;
  status: string;
  hasStats: boolean;
  homeScore: number | null;
  awayScore: number | null;
  isPractice: boolean;
  homeTeam: { id: string; name: string; logoUrl?: string | null };
  awayTeam: { id: string; name: string; logoUrl?: string | null };
  category: { id: string; name: string } | null;
  field: { id: string; name: string } | null;
  rescheduledFromId: string | null;
  rescheduledFrom: { id: string; scheduledAt: string } | null;
}

interface Standing {
  team: Team;
  gp: number;
  w: number;
  l: number;
  t: number;
  pts: number;
  rf: number;
  ra: number;
  pct: string;
}

interface Official { id: string; name: string; role: string }

interface SeasonConfig {
  pointsWin: number;
  pointsTie: number;
  pointsLoss: number;
  showPct: boolean;
  printDark: boolean;
  defaultTwinGames: boolean;
  defaultGameDurationMins: number;
}

interface Props {
  slug: string;
  seasonId: string;
  seasonName: string;
  startDate: string;
  endDate: string;
  seasonStatus: string;
  isAdmin: boolean;
  games: Game[];
  teams: Team[];
  categories: Category[];
  fields: Field[];
  officials?: Official[];
  standings: Standing[];
  seasonConfig: SeasonConfig;
  leagueName: string;
  leagueCity?: string | null;
  leagueState?: string | null;
  leagueLogoUrl?: string | null;
  officialBatting: OfficialBatterStat[];
  officialPitching: OfficialPitcherStat[];
  canCreatePractice: boolean;
}

type Tab = "schedule" | "standings" | "groups" | "hitting" | "pitching";

export function SeasonDashboard({
  slug, seasonId, seasonName, startDate, endDate, seasonStatus,
  isAdmin, games, teams, categories, fields, officials = [], standings,
  seasonConfig,
  leagueName, leagueCity, leagueState, leagueLogoUrl,
  officialBatting, officialPitching, canCreatePractice,
}: Props) {
  const router = useRouter();
  const { t } = useLanguage();
  const ts = t.season;
  const tg = ts.groups;

  const [tab, setTab] = useState<Tab>("schedule");

  // ── Season config modal ───────────────────────────────────────────────────
  const [configOpen,    setConfigOpen]    = useState(false);
  const [cfgWin,        setCfgWin]        = useState(seasonConfig.pointsWin);
  const [cfgTie,        setCfgTie]        = useState(seasonConfig.pointsTie);
  const [cfgLoss,       setCfgLoss]       = useState(seasonConfig.pointsLoss);
  const [cfgShowPct,    setCfgShowPct]    = useState(seasonConfig.showPct);
  const [cfgPrintDark,  setCfgPrintDark]  = useState(seasonConfig.printDark);
  const [cfgTwin,       setCfgTwin]       = useState(seasonConfig.defaultTwinGames);
  const [cfgDuration,   setCfgDuration]   = useState(seasonConfig.defaultGameDurationMins);
  const [cfgSaving,     setCfgSaving]     = useState(false);
  const [cfgError,      setCfgError]      = useState("");

  // Live copies used by the rest of the UI (updated on save)
  const [liveConfig, setLiveConfig] = useState(seasonConfig);

  function openConfig() {
    setCfgWin(liveConfig.pointsWin); setCfgTie(liveConfig.pointsTie); setCfgLoss(liveConfig.pointsLoss);
    setCfgShowPct(liveConfig.showPct); setCfgPrintDark(liveConfig.printDark);
    setCfgTwin(liveConfig.defaultTwinGames); setCfgDuration(liveConfig.defaultGameDurationMins);
    setCfgError(""); setConfigOpen(true);
  }

  async function saveConfig() {
    setCfgSaving(true); setCfgError("");
    const res = await fetch(`/api/leagues/${slug}/seasons/${seasonId}/config`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pointsWin: cfgWin, pointsTie: cfgTie, pointsLoss: cfgLoss,
        showPct: cfgShowPct, printDark: cfgPrintDark,
        defaultTwinGames: cfgTwin, defaultGameDurationMins: cfgDuration,
      }),
    });
    setCfgSaving(false);
    if (!res.ok) { const d = await res.json(); setCfgError(d.error ?? "Failed to save"); return; }
    const updated = await res.json();
    setLiveConfig({
      pointsWin: updated.pointsWin, pointsTie: updated.pointsTie, pointsLoss: updated.pointsLoss,
      showPct: updated.showPct, printDark: updated.printDark,
      defaultTwinGames: updated.defaultTwinGames, defaultGameDurationMins: updated.defaultGameDurationMins,
    });
    setConfigOpen(false);
    router.refresh();
  }
  const [assignDialog, setAssignDialog] = useState<{ dayKey: string; label: string } | null>(null);
  const [assignFieldId, setAssignFieldId]         = useState("");
  const [assignUmpireId, setAssignUmpireId]       = useState("");
  const [assignScorerId, setAssignScorerId]       = useState("");
  const [assigning, setAssigning]                 = useState(false);
  const [assignResult, setAssignResult]           = useState<string | null>(null);
  const [assignError, setAssignError]             = useState("");

  function openAssignDialog(dayKey: string, label: string) {
    setAssignDialog({ dayKey, label });
    setAssignFieldId(""); setAssignUmpireId(""); setAssignScorerId("");
    setAssignResult(null); setAssignError("");
  }

  async function handleAssign() {
    if (!assignUmpireId && !assignScorerId) { setAssignError("Select at least one official"); return; }
    setAssigning(true); setAssignError(""); setAssignResult(null);
    const res = await fetch(`/api/leagues/${slug}/seasons/${seasonId}/assign-officials`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: assignDialog!.dayKey,
        fieldId: assignFieldId || null,
        umpireUserId: assignUmpireId || null,
        scorekeeperUserId: assignScorerId || null,
      }),
    });
    setAssigning(false);
    if (!res.ok) { const d = await res.json(); setAssignError(d.error ?? "Failed"); return; }
    const { updated } = await res.json();
    setAssignResult(`${updated} game${updated !== 1 ? "s" : ""} updated`);
    router.refresh();
  }

  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(() => {
    const now = new Date();
    const dow = now.getDay(); // 0=Sun … 6=Sat
    const monday = new Date(now); monday.setDate(now.getDate() - ((dow + 6) % 7)); monday.setHours(0,0,0,0);
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6); sunday.setHours(23,59,59,999);
    const pad = (n: number) => String(n).padStart(2, "0");
    const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    return new Set(
      games
        .filter(g => { const d = new Date(g.scheduledAt); return d < monday || d > sunday; })
        .map(g => { const d = new Date(g.scheduledAt); return toKey(d); })
    );
  });
  function toggleDay(dayKey: string) {
    setCollapsedDays(prev => {
      const next = new Set(prev);
      next.has(dayKey) ? next.delete(dayKey) : next.add(dayKey);
      return next;
    });
  }
  const [gameError, setGameError] = useState<Record<string, string>>({});

  // Per-team group editing state
  const [groupValues, setGroupValues] = useState<Record<string, string>>(
    () => Object.fromEntries(teams.map((t) => [t.id, t.group ?? ""]))
  );
  const [groupSaving, setGroupSaving] = useState<Record<string, boolean>>({});
  const [groupSaved,  setGroupSaved]  = useState<Record<string, boolean>>({});
  const [groupError,  setGroupError]  = useState<Record<string, string>>({});

  const card = { borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" };
  const dim  = { color: "var(--sh-muted)" };

  function getStatusText(status: string, hasStats?: boolean) {
    if (status === "COMPLETED")   return hasStats === false ? "Final – no stats" : "Final";
    if (status === "IN_PROGRESS") return "Live";
    if (status === "CANCELLED")   return "Cancelled";
    if (status === "RESCHEDULED") return ts.schedule.rescheduledBadge;
    return ts.tabs.schedule;
  }

  function getSeasonStatusText(s: string) {
    if (s === "ACTIVE")    return { color: "var(--sh-primary)", text: ts.status.active };
    if (s === "COMPLETED") return { color: "var(--sh-muted)",   text: ts.status.completed };
    return { color: "var(--sh-warn)", text: ts.status.upcoming };
  }

  async function deleteGame(gameId: string) {
    setGameError({});
    const res = await fetch(`/api/leagues/${slug}/games/${gameId}`, { method: "DELETE" });
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json();
      setGameError((prev) => ({ ...prev, [gameId]: data.error ?? "Cannot delete" }));
    }
  }

  async function saveGroup(teamId: string) {
    setGroupSaving((p) => ({ ...p, [teamId]: true }));
    setGroupError((p)  => ({ ...p, [teamId]: "" }));
    setGroupSaved((p)  => ({ ...p, [teamId]: false }));

    const res = await fetch(`/api/leagues/${slug}/teams/${teamId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ group: groupValues[teamId].trim().toUpperCase() || null }),
    });

    setGroupSaving((p) => ({ ...p, [teamId]: false }));
    if (res.ok) {
      setGroupSaved((p) => ({ ...p, [teamId]: true }));
      router.refresh();
      setTimeout(() => setGroupSaved((p) => ({ ...p, [teamId]: false })), 2000);
    } else {
      const data = await res.json();
      setGroupError((p) => ({ ...p, [teamId]: data.error ?? tg.error }));
    }
  }

  function printStandings() {
    const logoEl = leagueLogoUrl
      ? `<img src="${leagueLogoUrl}" style="height:48px;width:48px;object-fit:contain;border-radius:6px;" />`
      : "";

    const dark = liveConfig.printDark;
    const showPct = liveConfig.showPct;
    const palette = dark
      ? { bg: "#0f172a", text: "#f1f5f9", muted: "#94a3b8", border: "#334155", headBg: "#1e293b", accent: "#22c55e", danger: "#f87171", warn: "#fbbf24", blue: "#60a5fa" }
      : { bg: "#ffffff", text: "#111827", muted: "#6b7280", border: "#e5e7eb", headBg: "#f9fafb", accent: "#16a34a", danger: "#ef4444", warn: "#ca8a04", blue: "#0284c7" };

    function tableHtml(rows: Standing[], groupLabel?: string) {
      const header = groupLabel
        ? `<h3 style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:${palette.accent};margin:0 0 6px;">${groupLabel}</h3>`
        : "";
      const headers = ["#","Team","GP","W","L","T","Pts","RF","RA","RD", ...(showPct ? ["Pct"] : [])];
      const trs = rows.map((s, i) => {
        const rd = s.rf - s.ra;
        return `
        <tr style="border-bottom:1px solid ${palette.border};">
          <td style="padding:6px 8px;font-weight:700;color:${i === 0 ? palette.warn : palette.muted};text-align:center;">${i + 1}</td>
          <td style="padding:6px 8px;font-weight:600;color:${palette.text};">${s.team.name}</td>
          <td style="padding:6px 8px;text-align:center;color:${palette.muted};">${s.gp}</td>
          <td style="padding:6px 8px;text-align:center;font-weight:700;color:${palette.accent};">${s.w}</td>
          <td style="padding:6px 8px;text-align:center;color:${palette.danger};">${s.l}</td>
          <td style="padding:6px 8px;text-align:center;color:${palette.muted};">${s.t}</td>
          <td style="padding:6px 8px;text-align:center;font-weight:700;color:${palette.text};">${s.pts}</td>
          <td style="padding:6px 8px;text-align:center;color:${palette.muted};">${s.rf}</td>
          <td style="padding:6px 8px;text-align:center;color:${palette.muted};">${s.ra}</td>
          <td style="padding:6px 8px;text-align:center;font-weight:700;color:${rd >= 0 ? palette.accent : palette.danger};">${rd > 0 ? "+" + rd : rd}</td>
          ${showPct ? `<td style="padding:6px 8px;text-align:center;color:${palette.blue};">${s.pct}</td>` : ""}
        </tr>`}).join("");
      return `${header}
        <table style="width:100%;border-collapse:collapse;font-family:-apple-system,sans-serif;font-size:12px;">
          <thead>
            <tr style="background:${palette.headBg};border-bottom:2px solid ${palette.accent};">
              ${headers.map(h =>
                `<th style="padding:6px 8px;text-align:${h === "Team" ? "left" : "center"};font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:${palette.muted};">${h}</th>`
              ).join("")}
            </tr>
          </thead>
          <tbody>${trs}</tbody>
        </table>`;
    }

    const body = hasGroups
      ? (() => {
          const cells = groupKeys.map(g => {
            const rows = standings.filter(s => (s.team.group ?? "") === g);
            const label = g ? `Group ${g}` : "Ungrouped";
            return `<div style="min-width:0;">${tableHtml(rows, label)}</div>`;
          });
          // Pair groups into rows of 2
          const rows: string[] = [];
          for (let i = 0; i < cells.length; i += 2) {
            const pair = cells.slice(i, i + 2);
            rows.push(`<div style="display:grid;grid-template-columns:${pair.length === 2 ? "1fr 1fr" : "1fr"};gap:20px;margin-bottom:20px;">${pair.join("")}</div>`);
          }
          return rows.join("");
        })()
      : tableHtml(standings);

    const html = `<!DOCTYPE html><html><head>
<meta charset="utf-8"><title>${leagueName} — ${seasonName} Standings</title>
<style>
  @page{size:letter portrait;margin:12mm 14mm;}
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:-apple-system,sans-serif;color:${palette.text};background:${palette.bg};}
  @media print{.no-print{display:none!important;}body{print-color-adjust:exact;-webkit-print-color-adjust:exact;}}
</style>
</head><body>
<div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:10px;border-bottom:3px solid ${palette.accent};margin-bottom:16px;">
  <div style="display:flex;align-items:center;gap:12px;">
    ${logoEl}
    <div>
      <div style="font-size:20px;font-weight:900;color:${palette.text};">${leagueName}</div>
      <div style="font-size:13px;color:${palette.muted};margin-top:2px;">${seasonName} — Standings</div>
    </div>
  </div>
  <div style="text-align:right;">
    <div style="font-size:11px;color:${palette.muted};">${new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</div>
    <button class="no-print" onclick="window.print()" style="margin-top:6px;padding:5px 16px;background:${palette.accent};color:white;border:none;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;">🖨 Print</button>
  </div>
</div>
${body}
</body></html>`;

    const w = window.open("", "_blank", "width=820,height=700");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
  }

  const tabs: { key: Tab; label: string; adminOnly?: boolean }[] = [
    { key: "schedule",  label: ts.tabs.schedule },
    { key: "standings", label: ts.tabs.standings },
    { key: "groups",    label: ts.tabs.groups, adminOnly: true },
    { key: "hitting",   label: ts.tabs.hitting },
    { key: "pitching",  label: ts.tabs.pitching },
  ];

  const visibleTabs = tabs.filter((tb) => !tb.adminOnly || isAdmin);

  const sb = getSeasonStatusText(seasonStatus);

  // Group standings logic
  const hasGroups = standings.some((s) => s.team.group);
  const groupKeys = hasGroups
    ? [...new Set(standings.map((s) => s.team.group ?? ""))].sort()
    : [];

  function StandingsTable({ rows }: { rows: Standing[] }) {
    return (
      <div className="rounded-2xl border overflow-hidden" style={card}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--sh-border)" }}>
              {[ts.standings.rank, ts.standings.team, ts.standings.gp, ts.standings.w, ts.standings.l, ts.standings.t, ts.standings.pts, ts.standings.rf, ts.standings.ra, ts.standings.rd, ...(liveConfig.showPct ? [ts.standings.pct] : []), ""].map((h, i) => (
                <th key={i} className="px-3 py-3 text-xs font-semibold uppercase tracking-wider text-center first:text-left" style={dim}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((s, i) => (
              <tr key={s.team.id} style={{ borderBottom: "1px solid var(--sh-border)" }}>
                <td className="px-3 py-3 text-center font-bold" style={{ color: i === 0 ? "var(--sh-warn)" : "var(--sh-muted)" }}>{i + 1}</td>
                <td className="px-3 py-3 font-semibold">
                  <div className="flex items-center gap-2">
                    <TeamAvatar name={s.team.name} logoUrl={s.team.logoUrl} size={6} />
                    <span style={{ color: "var(--sh-text)" }}>{s.team.name}</span>
                  </div>
                </td>
                <td className="px-3 py-3 text-center" style={dim}>{s.gp}</td>
                <td className="px-3 py-3 text-center font-bold" style={{ color: "var(--sh-primary)" }}>{s.w}</td>
                <td className="px-3 py-3 text-center" style={{ color: "var(--sh-danger)" }}>{s.l}</td>
                <td className="px-3 py-3 text-center" style={dim}>{s.t}</td>
                <td className="px-3 py-3 text-center font-bold" style={{ color: "var(--sh-text)" }}>{s.pts}</td>
                <td className="px-3 py-3 text-center" style={dim}>{s.rf}</td>
                <td className="px-3 py-3 text-center" style={dim}>{s.ra}</td>
                <td className="px-3 py-3 text-center font-semibold" style={{ color: s.rf - s.ra >= 0 ? "var(--sh-primary)" : "var(--sh-danger)" }}>{s.rf - s.ra > 0 ? `+${s.rf - s.ra}` : s.rf - s.ra}</td>
                {liveConfig.showPct && <td className="px-3 py-3 text-center" style={{ color: "var(--sh-secondary)" }}>{s.pct}</td>}
                <td className="px-3 py-3 text-center">
                  <Link
                    href={`/league/${slug}/season/${seasonId}/team/${s.team.id}/stats`}
                    className="text-xs font-semibold px-2.5 py-1 rounded-lg border"
                    style={{ color: "var(--sh-primary)", borderColor: "var(--sh-border2)", background: "transparent" }}
                  >
                    📊 Stats
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // ── Split regular vs practice games ────────────────────────────────────────
  const regularGames  = games.filter(g => !g.isPractice);
  const practiceGames = games.filter(g =>  g.isPractice);

  // ── Grouped schedule: day → category ───────────────────────────────────────
  const groupedDays = (() => {
    const dayMap = new Map<string, { label: string; grpMap: Map<string, { grpName: string; catGames: Game[] }> }>();
    for (const game of regularGames) {
      const d = new Date(game.scheduledAt);
      const dayKey  = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const dayLabel = d.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
      if (!dayMap.has(dayKey)) dayMap.set(dayKey, { label: dayLabel, grpMap: new Map() });
      const grpKey  = game.fieldId ?? "__none__";
      const grpName = game.field?.name ?? "";
      const day = dayMap.get(dayKey)!;
      if (!day.grpMap.has(grpKey)) day.grpMap.set(grpKey, { grpName, catGames: [] });
      day.grpMap.get(grpKey)!.catGames.push(game);
    }
    return [...dayMap.entries()].map(([dayKey, { label, grpMap }]) => ({
      dayKey,
      label,
      catGroups: [...grpMap.values()].sort((a, b) => {
        // No-field bucket always last
        if (!a.grpName && b.grpName) return 1;
        if (a.grpName && !b.grpName) return -1;
        return a.grpName.localeCompare(b.grpName, undefined, { numeric: true, sensitivity: "base" });
      }),
    }));
  })();

  function printSchedule() {
    const dayRows = groupedDays.map(({ label, catGroups }) => {
      const catRows = catGroups.map(({ grpName, catGames }) => {
        const catHeader = grpName
          ? `<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#16a34a;padding:5px 0 2px;margin-top:6px;">🏟️ ${grpName}</div>`
          : "";
        const gameRows = catGames.map((game) => {
          const d = new Date(game.scheduledAt);
          const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          const hGroup = teams.find((t) => t.id === game.homeTeamId)?.group;
          const aGroup = teams.find((t) => t.id === game.awayTeamId)?.group;
          const grpLabel = hGroup && aGroup && hGroup === aGroup
            ? `Group ${hGroup}`
            : hGroup && aGroup
            ? `Group ${hGroup} / ${aGroup}`
            : hGroup ? `Group ${hGroup}` : aGroup ? `Group ${aGroup}` : null;
          const score  = game.status === "COMPLETED"
            ? `<strong style="color:#16a34a;">${game.homeScore ?? 0} – ${game.awayScore ?? 0}</strong>`
            : `<span style="color:#999;">vs</span>`;
          const badgeColor = game.status === "COMPLETED" && !game.hasStats ? ["#fef3c7","#b45309"]
            : game.status === "COMPLETED"   ? ["#dcfce7","#15803d"]
            : game.status === "CANCELLED"   ? ["#fee2e2","#dc2626"]
            : game.status === "RESCHEDULED" ? ["#f3e8ff","#9333ea"]
            : game.status === "IN_PROGRESS" ? ["#fef9c3","#ca8a04"]
            : null;
          const badge = badgeColor
            ? `<span style="font-size:10px;padding:1px 7px;border-radius:99px;background:${badgeColor[0]};color:${badgeColor[1]};">${getStatusText(game.status, game.hasStats)}</span>`
            : "";
          const meta = grpLabel ?? "";
          const teamAvatar = (name: string, logoUrl?: string | null) =>
            logoUrl
              ? `<img src="${logoUrl}" style="width:18px;height:18px;border-radius:3px;object-fit:cover;vertical-align:middle;margin-right:3px;" alt="" />`
              : `<span style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:3px;background:#dcfce7;color:#15803d;font-size:9px;font-weight:700;vertical-align:middle;margin-right:3px;">${name.charAt(0)}</span>`;
          return `<tr>
            <td style="padding:5px 8px;font-size:12px;color:#555;white-space:nowrap;vertical-align:middle;">${time}</td>
            <td style="padding:5px 8px;font-size:13px;vertical-align:middle;">
              ${teamAvatar(game.homeTeam.name, game.homeTeam.logoUrl)}<span style="font-weight:600;">${game.homeTeam.name}</span>
              ${score}
              ${teamAvatar(game.awayTeam.name, game.awayTeam.logoUrl)}<span style="font-weight:600;">${game.awayTeam.name}</span>
              ${badge ? " " + badge : ""}
            </td>
            <td style="padding:5px 8px;font-size:11px;color:#888;vertical-align:middle;">${meta}</td>
          </tr>`;
        }).join("");
        return catHeader + `<table style="width:100%;border-collapse:collapse;">${gameRows}</table>`;
      }).join("");
      return `<div style="margin-bottom:18px;">
        <div style="font-size:14px;font-weight:700;padding:7px 10px;background:#f0fdf4;border-left:4px solid #16a34a;margin-bottom:4px;">
          📅 ${label}
        </div>
        ${catRows}
      </div>`;
    }).join("");

    const leagueLocation = [leagueCity, leagueState].filter(Boolean).join(", ");
    const leagueLogoHtml = leagueLogoUrl
      ? `<img src="${leagueLogoUrl}" style="width:52px;height:52px;border-radius:8px;object-fit:cover;flex-shrink:0;" alt="" />`
      : "";
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>${leagueName} — ${seasonName} — Schedule</title>
      <style>
        @page { size: letter portrait; margin: 16mm 14mm; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: sans-serif; color: #111; width: 178mm; padding: 16px 24px; }
        @media print { body { padding: 0; } }
        table tr:nth-child(even) { background: #f9fafb; }
      </style>
    </head><body>
      <div style="padding-bottom:14px;border-bottom:3px solid #16a34a;margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
          ${leagueLogoHtml}
          <div>
            <div style="font-size:13px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:.05em;">${leagueName}</div>
            ${leagueLocation ? `<div style="font-size:11px;color:#888;margin-top:2px;">📍 ${leagueLocation}</div>` : ""}
          </div>
        </div>
        <div style="font-size:22px;font-weight:800;">${seasonName}</div>
        <div style="font-size:13px;color:#555;margin-top:4px;">
          ${new Date(startDate).toLocaleDateString()} – ${new Date(endDate).toLocaleDateString()}
          · ${regularGames.length} game${regularGames.length !== 1 ? "s" : ""}
        </div>
      </div>
      ${dayRows}
    </body></html>`;

    const w = window.open("", "_blank", "width=820,height=1060");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 400);
  }

  return (
    <>
    <div className="space-y-6">
      {/* ── Season info row ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--sh-text)" }}>{seasonName}</h1>
          <p className="text-sm mt-1" style={{ color: "var(--sh-primary)" }}>
            {new Date(startDate).toLocaleDateString()} – {new Date(endDate).toLocaleDateString()}
            {" · "}
            <span style={{ color: sb.color }}>{sb.text}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
              <button
                type="button"
                onClick={openConfig}
                className="text-xs px-3 py-1.5 rounded-lg border hover:opacity-80 transition-opacity"
                style={{ borderColor: "var(--sh-border2)", color: "var(--sh-secondary)", background: "transparent" }}
                title="Season configuration"
              >
                ⚙️ Config
              </button>
              <ScheduleGeneratorDialog
                slug={slug}
                seasonId={seasonId}
                seasonName={seasonName}
                seasonStart={startDate}
                seasonEnd={endDate}
                fields={fields}
                teamCount={teams.length}
              />
              <AddGameDialog slug={slug} seasonId={seasonId} teams={teams} categories={categories} fields={fields} defaultTwinGames={liveConfig.defaultTwinGames} />
            </>
          )}
          {canCreatePractice && !isAdmin && (
            <AddGameDialog slug={slug} seasonId={seasonId} teams={teams} categories={categories} fields={fields} isPracticeOnly />
          )}
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex gap-1 rounded-xl p-1" style={{ background: "var(--sh-bg-card)", border: "1px solid var(--sh-border)" }}>
        {visibleTabs.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
            style={
              tab === tb.key
                ? { background: "var(--sh-primary-dark)", color: "#fff" }
                : { color: "var(--sh-primary)", background: "transparent" }
            }
          >
            {tb.label}
          </button>
        ))}
      </div>

      {/* ── Schedule ── */}
      {tab === "schedule" && (
        <div>
          {/* Schedule header: count + print */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs" style={dim}>{regularGames.length} game{regularGames.length !== 1 ? "s" : ""}</p>
            {regularGames.length > 0 && (
              <button
                onClick={printSchedule}
                className="text-xs px-3 py-1.5 rounded-lg border hover:opacity-70"
                style={{ borderColor: "var(--sh-border2)", color: "var(--sh-muted)", background: "transparent" }}
              >
                🖨 Print schedule
              </button>
            )}
          </div>

          {regularGames.length === 0 ? (
            <div className="rounded-2xl border py-16 text-center text-sm" style={{ ...card, color: "var(--sh-primary)" }}>
              {ts.schedule.none}{isAdmin && ts.schedule.noneAdmin}
            </div>
          ) : (
            <div className="space-y-6">
              {groupedDays.map(({ dayKey, label, catGroups }) => {
                const collapsed = collapsedDays.has(dayKey);
                const totalGames = catGroups.reduce((s, g) => s + g.catGames.length, 0);
                return (
                <div key={dayKey}>
                  {/* Day header */}
                  <div
                    className="w-full flex items-center justify-between gap-2 mb-3"
                    style={{ borderLeft: "3px solid var(--sh-primary)", paddingLeft: "10px" }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleDay(dayKey)}
                      className="flex-1 text-left font-bold text-sm"
                      style={{ color: "var(--sh-text)" }}
                    >
                      📅 {label}
                    </button>
                    <span className="flex items-center gap-2 shrink-0">
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => openAssignDialog(dayKey, label)}
                          className="text-xs px-2 py-0.5 rounded border hover:opacity-80 transition-opacity"
                          style={{ borderColor: "var(--sh-border2)", color: "var(--sh-secondary)", background: "transparent" }}
                        >
                          👤 Assign
                        </button>
                      )}
                      {collapsed && (
                        <span className="text-xs" style={{ color: "var(--sh-muted)" }}>
                          {totalGames} game{totalGames !== 1 ? "s" : ""}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleDay(dayKey)}
                        className="text-xs transition-transform"
                        style={{ color: "var(--sh-muted)", transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)", display: "inline-block" }}
                      >
                        ▾
                      </button>
                    </span>
                  </div>

                  {!collapsed && <div className="space-y-4">
                    {catGroups.map(({ grpName, catGames }) => (
                      <div key={grpName || "__none__"}>
                        {/* Field sub-header */}
                        {grpName && (
                          <p className="text-xs font-semibold uppercase tracking-wider mb-2 ml-1"
                            style={{ color: "var(--sh-primary)" }}>
                            🏟️ {grpName}
                          </p>
                        )}

                        <div className="space-y-2">
                          {catGames.map((game) => {
                            const badge = {
                              bg:    game.status === "COMPLETED"   ? "var(--sh-approved-bg)"
                                   : game.status === "IN_PROGRESS" ? "var(--sh-warn-bg)"
                                   : game.status === "CANCELLED"   ? "var(--sh-danger-bg)"
                                   : game.status === "RESCHEDULED" ? "var(--sh-purple-bg)"
                                   : "var(--sh-info-bg)",
                              color: game.status === "COMPLETED"   ? "var(--sh-primary)"
                                   : game.status === "IN_PROGRESS" ? "var(--sh-warn)"
                                   : game.status === "CANCELLED"   ? "var(--sh-danger)"
                                   : game.status === "RESCHEDULED" ? "var(--sh-purple)"
                                   : "var(--sh-info)",
                              text:  getStatusText(game.status),
                            };
                            const homeGroup = teams.find((t) => t.id === game.homeTeamId)?.group;
                            const awayGroup = teams.find((t) => t.id === game.awayTeamId)?.group;
                            const gameGroup = homeGroup && homeGroup === awayGroup ? homeGroup : null;
                            const date = new Date(game.scheduledAt);
                            return (
                              <div key={game.id} className="rounded-xl border p-4" style={card}>
                                {gameError[game.id] && (
                                  <p className="text-xs mb-2" style={{ color: "var(--sh-danger)" }}>{gameError[game.id]}</p>
                                )}
                                {/* Time + field */}
                                <div className="flex items-center gap-3 mb-2 flex-wrap">
                                  <span className="text-xs font-semibold" style={{ color: "var(--sh-secondary)" }}>
                                    🕐 {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                  {game.field && (
                                    <span className="text-xs" style={{ color: "var(--sh-muted)" }}>
                                      🏟️ {game.field.name}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                  {/* Teams & score */}
                                  <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <div className="text-right flex-1 flex items-center justify-end gap-2">
                                      <div>
                                        <p className="font-bold truncate" style={{ color: "var(--sh-text)" }}>{game.homeTeam.name}</p>
                                        <p className="text-xs" style={{ color: game.homeAwayTbd ? "var(--sh-warn)" : "var(--sh-primary)" }}>
                                          {game.homeAwayTbd ? ts.schedule.tbd : ts.schedule.home}
                                        </p>
                                      </div>
                                      <TeamAvatar name={game.homeTeam.name} logoUrl={game.homeTeam.logoUrl} size={8} />
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      {game.status === "COMPLETED" ? (
                                        <span className="text-xl font-bold" style={{ color: "var(--sh-primary)" }}>
                                          {game.homeScore ?? 0} – {game.awayScore ?? 0}
                                        </span>
                                      ) : (
                                        <span className="text-sm font-semibold" style={dim}>vs</span>
                                      )}
                                    </div>
                                    <div className="flex-1 flex items-center gap-2">
                                      <TeamAvatar name={game.awayTeam.name} logoUrl={game.awayTeam.logoUrl} size={8} />
                                      <div>
                                        <p className="font-bold truncate" style={{ color: "var(--sh-text)" }}>{game.awayTeam.name}</p>
                                        <p className="text-xs" style={{ color: game.homeAwayTbd ? "var(--sh-warn)" : "var(--sh-primary)" }}>
                                          {game.homeAwayTbd ? ts.schedule.tbd : ts.schedule.away}
                                        </p>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Meta + actions */}
                                  <div className="text-right shrink-0 space-y-1">
                                    <div className="flex items-center gap-2 justify-end flex-wrap">
                                      {gameGroup && (
                                        <span className="text-xs font-semibold rounded-full px-2 py-0.5"
                                          style={{ background: "var(--sh-info-bg)", color: "var(--sh-info)" }}>
                                          {tg.groupStandings} {gameGroup}
                                        </span>
                                      )}
                                      <span className="text-xs font-semibold rounded-full px-2.5 py-0.5"
                                        style={{ background: badge.bg, color: badge.color }}>
                                        {badge.text}
                                      </span>
                                      {isAdmin && game.status === "SCHEDULED" && (
                                        <>
                                          <EditGameDialog slug={slug} game={game} teams={teams} categories={categories} fields={fields} />
                                          <RescheduleGameDialog slug={slug} game={game} teams={teams} categories={categories} fields={fields} />
                                          <button
                                            onClick={() => deleteGame(game.id)}
                                            className="text-xs px-2 py-1 rounded-md border hover:opacity-80"
                                            style={{ borderColor: "var(--sh-danger-border)", color: "var(--sh-danger)", background: "transparent" }}
                                          >
                                            {ts.schedule.delete}
                                          </button>
                                        </>
                                      )}
                                      {(game.status === "SCHEDULED" || game.status === "IN_PROGRESS") && (
                                        <Link
                                          href={`/league/${slug}/season/${seasonId}/game/${game.id}`}
                                          className="text-xs font-semibold px-3 py-1 rounded-lg transition-all hover:opacity-80"
                                          style={{ background: "var(--sh-bg-card2)", color: "var(--sh-primary)", border: "1px solid var(--sh-border2)" }}
                                        >
                                          {ts.schedule.scoring}
                                        </Link>
                                      )}
                                      {game.status === "COMPLETED" && (
                                        <Link
                                          href={`/league/${slug}/season/${seasonId}/game/${game.id}`}
                                          className="text-xs font-semibold px-3 py-1 rounded-lg transition-all hover:opacity-80"
                                          style={{ background: "var(--sh-bg-card2)", color: "var(--sh-muted)", border: "1px solid var(--sh-border2)" }}
                                        >
                                          {isAdmin ? "View / Edit" : "View"}
                                        </Link>
                                      )}
                                    </div>
                                    <p className="text-xs" style={dim}>
                                      {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                    </p>
                                    {game.field && <p className="text-xs" style={{ color: "var(--sh-primary)" }}>🏟️ {game.field.name}</p>}
                                    {game.category && <p className="text-xs" style={{ color: "var(--sh-info)" }}>{game.category.name}</p>}
                                    {game.rescheduledFrom && (
                                      <p className="text-xs" style={{ color: "var(--sh-purple)" }}>
                                        ↺ {ts.schedule.replacesGame}{" "}
                                        {new Date(game.rescheduledFrom.scheduledAt).toLocaleDateString()}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>}
                </div>
                );
              })}
            </div>
          )}
        {/* Practice games section */}
        {practiceGames.length > 0 && (
          <div className="mt-6 rounded-2xl border overflow-hidden" style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card2)" }}>
            <div className="px-4 py-3 flex items-center justify-between border-b" style={{ borderColor: "var(--sh-border)" }}>
              <span className="text-sm font-semibold" style={{ color: "#f59e0b" }}>🎯 Practice Games</span>
              <span className="text-xs" style={{ color: "var(--sh-muted)" }}>{practiceGames.length} session{practiceGames.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="divide-y" style={{ borderColor: "var(--sh-border)" }}>
              {practiceGames.map(game => {
                const date = new Date(game.scheduledAt);
                const isActive = game.status === "IN_PROGRESS";
                return (
                  <div key={game.id} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap text-sm font-medium" style={{ color: "var(--sh-text)" }}>
                        {isActive && <span className="text-xs font-bold animate-pulse" style={{ color: "#f59e0b" }}>● LIVE</span>}
                        <span>{game.homeTeam.name}</span>
                        <span style={{ color: "var(--sh-muted)" }}>vs</span>
                        <span>{game.awayTeam.name}</span>
                        {(game.status === "COMPLETED") && game.homeScore != null && (
                          <span className="text-xs font-bold" style={{ color: "var(--sh-primary)" }}>
                            {game.homeScore} – {game.awayScore}
                          </span>
                        )}
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: "var(--sh-muted)" }}>
                        {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {game.field && ` · 🏟️ ${game.field.name}`}
                      </p>
                    </div>
                    <Link
                      href={`/league/${slug}/season/${seasonId}/game/${game.id}`}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg shrink-0 transition-all hover:opacity-80"
                      style={{ background: "#451a03", color: "#f59e0b", border: "1px solid #92400e" }}
                    >
                      {isActive ? "Live →" : "Open →"}
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        </div>
      )}

      {/* ── Standings ── */}
      {tab === "standings" && (
        <div className="space-y-6">
          {standings.length > 0 && (
            <div className="flex justify-end">
              <button
                onClick={printStandings}
                className="text-xs px-3 py-1.5 rounded-lg border transition-colors hover:opacity-80"
                style={{ borderColor: "var(--sh-border2)", color: "var(--sh-secondary)", background: "transparent" }}
              >
                🖨 Print standings
              </button>
            </div>
          )}
          {standings.length === 0 ? (
            <div className="rounded-2xl border py-16 text-center text-sm" style={{ ...card, color: "var(--sh-primary)" }}>
              {ts.standings.none}
            </div>
          ) : hasGroups ? (
            // Per-group standings
            groupKeys.map((g) => {
              const rows = standings.filter((s) => (s.team.group ?? "") === g);
              const label = g ? `${tg.groupStandings} ${g}` : tg.ungrouped;
              return (
                <div key={g} className="space-y-2">
                  <h3 className="text-sm font-bold uppercase tracking-widest" style={{ color: "var(--sh-primary)" }}>
                    {label}
                  </h3>
                  <StandingsTable rows={rows} />
                </div>
              );
            })
          ) : (
            <StandingsTable rows={standings} />
          )}
        </div>
      )}

      {/* ── Groups (admin only) ── */}
      {tab === "groups" && isAdmin && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold" style={{ color: "var(--sh-text)" }}>{tg.title}</h2>
            <p className="text-sm mt-1" style={{ color: "var(--sh-muted)" }}>{tg.hint}</p>
          </div>

          {teams.length === 0 ? (
            <div className="rounded-2xl border py-14 text-center text-sm" style={{ ...card, color: "var(--sh-primary)" }}>
              {tg.none}
            </div>
          ) : (
            <div className="space-y-2">
              {teams.map((team) => (
                <div
                  key={team.id}
                  className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3"
                  style={card}
                >
                  <span className="font-semibold text-sm" style={{ color: "var(--sh-text)" }}>{team.name}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href={`/league/${slug}/season/${seasonId}/team/${team.id}/stats`}
                      className="text-xs font-semibold px-2.5 py-1 rounded-lg border"
                      style={{ color: "var(--sh-primary)", borderColor: "var(--sh-border2)", background: "transparent" }}
                    >
                      📊 Stats
                    </Link>
                    {groupValues[team.id] && (
                      <span
                        className="text-xs font-bold rounded-full px-2.5 py-0.5"
                        style={{ background: "var(--sh-info-bg)", color: "var(--sh-info)" }}
                      >
                        {tg.groupStandings} {groupValues[team.id].toUpperCase()}
                      </span>
                    )}
                    <input
                      type="text"
                      maxLength={4}
                      value={groupValues[team.id]}
                      onChange={(e) => setGroupValues((p) => ({ ...p, [team.id]: e.target.value.toUpperCase() }))}
                      placeholder={tg.placeholder}
                      className="w-16 rounded-md border px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-green-500"
                      style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card2)", color: "var(--sh-text)" }}
                      onKeyDown={(e) => { if (e.key === "Enter") saveGroup(team.id); }}
                    />
                    <button
                      onClick={() => saveGroup(team.id)}
                      disabled={groupSaving[team.id]}
                      className="text-xs px-3 py-1.5 rounded-md border font-semibold transition-colors hover:opacity-80 disabled:opacity-40"
                      style={
                        groupSaved[team.id]
                          ? { borderColor: "var(--sh-primary)", color: "var(--sh-primary)", background: "var(--sh-approved-bg)" }
                          : { borderColor: "var(--sh-border2)", color: "var(--sh-secondary)", background: "transparent" }
                      }
                    >
                      {groupSaving[team.id] ? tg.saving : groupSaved[team.id] ? tg.saved : tg.save}
                    </button>
                    {groupError[team.id] && (
                      <span className="text-xs" style={{ color: "var(--sh-danger)" }}>{groupError[team.id]}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Hitting Stats ── */}
      {tab === "hitting" && (
        officialBatting.length === 0 ? (
          <div className="rounded-2xl border py-16 text-center" style={card}>
            <p className="text-2xl mb-3">🏏</p>
            <p className="font-semibold mb-1" style={{ color: "var(--sh-text)" }}>{ts.stats.hittingTitle}</p>
            <p className="text-sm" style={{ color: "var(--sh-primary)" }}>{ts.stats.hittingDesc}</p>
          </div>
        ) : (
          <div className="rounded-2xl border overflow-hidden" style={card}>
            <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--sh-border)" }}>
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--sh-muted)" }}>
                🏏 Season Batting — Official
              </span>
              <span className="text-xs" style={{ color: "var(--sh-muted)" }}>{officialBatting.length} players</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--sh-border)" }}>
                    {["Player", "AB", "H", "1B", "2B", "3B", "HR", "BB", "K", "AVG", "OBP"].map(h => (
                      <th key={h} className="px-3 py-2 text-xs font-semibold uppercase tracking-wider"
                        style={{ color: "var(--sh-muted)", textAlign: h === "Player" ? "left" : "center" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {officialBatting.map(s => (
                    <tr key={s.playerId} style={{ borderBottom: "1px solid var(--sh-border)" }}>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          {s.nationality && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={flagUrl(s.nationality)} alt="" className="w-4 shrink-0" style={{ height: "11px", objectFit: "cover", borderRadius: "1px" }} />
                          )}
                          <span className="font-medium" style={{ color: "var(--sh-text)" }}>{s.name}</span>
                          {s.jerseyNumber && <span className="text-xs" style={{ color: "var(--sh-muted)" }}>#{s.jerseyNumber}</span>}
                        </div>
                      </td>
                      {[s.ab, s.h, s.singles, s.doubles, s.triples, s.hr, s.bb, s.k].map((v, i) => (
                        <td key={i} className="px-3 py-2 text-center" style={{ color: "var(--sh-secondary)" }}>{v}</td>
                      ))}
                      <td className="px-3 py-2 text-center font-bold" style={{ color: "var(--sh-primary)" }}>{s.ba}</td>
                      <td className="px-3 py-2 text-center" style={{ color: "var(--sh-secondary)" }}>{s.obp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* ── Pitching Stats ── */}
      {tab === "pitching" && (
        officialPitching.length === 0 ? (
          <div className="rounded-2xl border py-16 text-center" style={card}>
            <p className="text-2xl mb-3">⚾</p>
            <p className="font-semibold mb-1" style={{ color: "var(--sh-text)" }}>{ts.stats.pitchingTitle}</p>
            <p className="text-sm" style={{ color: "var(--sh-primary)" }}>{ts.stats.pitchingDesc}</p>
          </div>
        ) : (
          <div className="rounded-2xl border overflow-hidden" style={card}>
            <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--sh-border)" }}>
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--sh-muted)" }}>
                ⚾ Season Pitching — Official
              </span>
              <span className="text-xs" style={{ color: "var(--sh-muted)" }}>{officialPitching.length} pitchers</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--sh-border)" }}>
                    {["Pitcher", "IP", "H", "BB", "K"].map(h => (
                      <th key={h} className="px-3 py-2 text-xs font-semibold uppercase tracking-wider"
                        style={{ color: "var(--sh-muted)", textAlign: h === "Pitcher" ? "left" : "center" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {officialPitching.map(s => (
                    <tr key={s.playerId} style={{ borderBottom: "1px solid var(--sh-border)" }}>
                      <td className="px-3 py-2 font-medium" style={{ color: "var(--sh-text)" }}>
                        {s.name}
                        {s.jerseyNumber && <span className="text-xs ml-1.5" style={{ color: "var(--sh-muted)" }}>#{s.jerseyNumber}</span>}
                      </td>
                      <td className="px-3 py-2 text-center font-bold" style={{ color: "var(--sh-primary)" }}>{s.ip}</td>
                      <td className="px-3 py-2 text-center" style={{ color: "var(--sh-secondary)" }}>{s.h}</td>
                      <td className="px-3 py-2 text-center" style={{ color: "var(--sh-secondary)" }}>{s.bb}</td>
                      <td className="px-3 py-2 text-center" style={{ color: "var(--sh-secondary)" }}>{s.k}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>

    {/* ── Season Config Modal ── */}
    {configOpen && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.6)" }}
        onClick={() => setConfigOpen(false)}
      >
        <div
          className="rounded-2xl border shadow-2xl w-full max-w-md p-6 space-y-5"
          style={{ background: "var(--sh-bg-card)", borderColor: "var(--sh-border2)" }}
          onClick={e => e.stopPropagation()}
        >
          <h2 className="font-bold text-lg" style={{ color: "var(--sh-text)" }}>⚙️ Season Configuration</h2>

          {/* Points */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--sh-primary)" }}>Standings Points</p>
            <div className="grid grid-cols-3 gap-3">
              {([["Win", cfgWin, setCfgWin], ["Tie", cfgTie, setCfgTie], ["Loss", cfgLoss, setCfgLoss]] as const).map(([label, val, setter]) => (
                <div key={label}>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--sh-secondary)" }}>{label}</label>
                  <input
                    type="number" min={0} max={10}
                    value={val}
                    onChange={e => (setter as (v: number) => void)(Number(e.target.value))}
                    className="w-full text-sm rounded-lg border px-3 py-2 text-center"
                    style={{ background: "var(--sh-bg-card2)", borderColor: "var(--sh-border2)", color: "var(--sh-text)" }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Display */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--sh-primary)" }}>Display</p>
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input type="checkbox" checked={cfgShowPct} onChange={e => setCfgShowPct(e.target.checked)} className="accent-green-500 w-4 h-4" />
              <span className="text-sm" style={{ color: "var(--sh-text)" }}>Show PCT (win percentage) column</span>
            </label>
          </div>

          {/* Print */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--sh-primary)" }}>Print Standings</p>
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input type="checkbox" checked={cfgPrintDark} onChange={e => setCfgPrintDark(e.target.checked)} className="accent-slate-500 w-4 h-4" />
              <span className="text-sm" style={{ color: "var(--sh-text)" }}>Dark background when printing</span>
            </label>
          </div>

          {/* Game defaults */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--sh-primary)" }}>Game Defaults</p>
            <div className="space-y-2">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input type="checkbox" checked={cfgTwin} onChange={e => setCfgTwin(e.target.checked)} className="accent-blue-500 w-4 h-4" />
                <span className="text-sm" style={{ color: "var(--sh-text)" }}>Pre-check "twin game" when adding a game</span>
              </label>
              <div className="flex items-center gap-3 mt-1">
                <label className="text-sm shrink-0" style={{ color: "var(--sh-secondary)" }}>Default duration (mins)</label>
                <input
                  type="number" min={15} max={300} step={5}
                  value={cfgDuration}
                  onChange={e => setCfgDuration(Number(e.target.value))}
                  className="w-24 text-sm rounded-lg border px-3 py-2 text-center"
                  style={{ background: "var(--sh-bg-card2)", borderColor: "var(--sh-border2)", color: "var(--sh-text)" }}
                />
              </div>
            </div>
          </div>

          {cfgError && <p className="text-xs" style={{ color: "var(--sh-danger)" }}>{cfgError}</p>}

          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={() => setConfigOpen(false)}
              disabled={cfgSaving}
              className="text-sm px-4 py-2 rounded-lg border hover:opacity-80"
              style={{ borderColor: "var(--sh-border2)", color: "var(--sh-secondary)", background: "transparent" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveConfig}
              disabled={cfgSaving}
              className="text-sm px-4 py-2 rounded-lg font-semibold hover:opacity-80 disabled:opacity-50"
              style={{ background: "var(--sh-primary)", color: "var(--sh-bg-page)" }}
            >
              {cfgSaving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ── Assign Officials Modal ── */}
    {assignDialog && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.6)" }}
        onClick={() => setAssignDialog(null)}
      >
        <div
          className="rounded-2xl border shadow-2xl w-full max-w-sm p-6 space-y-4"
          style={{ background: "var(--sh-bg-card)", borderColor: "var(--sh-border2)" }}
          onClick={e => e.stopPropagation()}
        >
          <h2 className="font-bold text-lg" style={{ color: "var(--sh-text)" }}>👤 Assign Officials</h2>
          <p className="text-sm" style={{ color: "var(--sh-muted)" }}>📅 {assignDialog.label}</p>

          {officials.length === 0 && (
            <p className="text-xs rounded-lg px-3 py-2" style={{ background: "var(--sh-warn-bg)", color: "var(--sh-warn)" }}>
              No umpires or scorekeepers found. Go to <strong>Members</strong> and assign the Umpire or Scorekeeper role to users first.
            </p>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "var(--sh-secondary)" }}>
                Field <span style={{ color: "var(--sh-muted)", fontWeight: 400 }}>(leave blank for all fields)</span>
              </label>
              <select
                value={assignFieldId}
                onChange={e => setAssignFieldId(e.target.value)}
                className="w-full text-sm rounded-lg border px-3 py-2"
                style={{ background: "var(--sh-bg-card2)", borderColor: "var(--sh-border2)", color: "var(--sh-text)" }}
              >
                <option value="">All fields</option>
                {fields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "var(--sh-secondary)" }}>Umpire</label>
              <select
                value={assignUmpireId}
                onChange={e => setAssignUmpireId(e.target.value)}
                className="w-full text-sm rounded-lg border px-3 py-2"
                style={{ background: "var(--sh-bg-card2)", borderColor: "var(--sh-border2)", color: "var(--sh-text)" }}
              >
                <option value="">— none —</option>
                {officials.filter(o => o.role === "UMPIRE").map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "var(--sh-secondary)" }}>Scorekeeper</label>
              <select
                value={assignScorerId}
                onChange={e => setAssignScorerId(e.target.value)}
                className="w-full text-sm rounded-lg border px-3 py-2"
                style={{ background: "var(--sh-bg-card2)", borderColor: "var(--sh-border2)", color: "var(--sh-text)" }}
              >
                <option value="">— none —</option>
                {officials.filter(o => o.role === "SCOREKEEPER").map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
          </div>

          {assignError && (
            <p className="text-xs" style={{ color: "var(--sh-danger)" }}>{assignError}</p>
          )}
          {assignResult && (
            <p className="text-xs font-semibold" style={{ color: "var(--sh-primary)" }}>✓ {assignResult}</p>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={() => setAssignDialog(null)}
              disabled={assigning}
              className="text-sm px-4 py-2 rounded-lg border hover:opacity-80"
              style={{ borderColor: "var(--sh-border2)", color: "var(--sh-secondary)", background: "transparent" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAssign}
              disabled={assigning}
              className="text-sm px-4 py-2 rounded-lg font-semibold hover:opacity-80 disabled:opacity-50"
              style={{ background: "var(--sh-primary)", color: "var(--sh-bg-page)" }}
            >
              {assigning ? "Assigning…" : "Assign"}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
