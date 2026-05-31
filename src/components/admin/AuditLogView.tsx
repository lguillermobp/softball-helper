"use client";

import { useState, useEffect, useCallback } from "react";

interface AuditEntry {
  id: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  leagueId: string | null;
  leagueName: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

const ACTION_COLORS: Record<string, { bg: string; color: string }> = {
  "player.create":        { bg: "#14532d", color: "#4ade80" },
  "player.update":        { bg: "#1e3a5f", color: "#93c5fd" },
  "player.invite.resend": { bg: "#1e3a5f", color: "#93c5fd" },
  "team.create":          { bg: "#14532d", color: "#4ade80" },
  "team.update":          { bg: "#1e3a5f", color: "#93c5fd" },
  "team.delete":          { bg: "#450a0a", color: "#f87171" },
  "member.add":           { bg: "#14532d", color: "#4ade80" },
  "member.role.change":  { bg: "#1e3a5f", color: "#93c5fd" },
  "member.remove":       { bg: "#450a0a", color: "#f87171" },
  "team.logo.upload":     { bg: "#1e3a5f", color: "#93c5fd" },
  "league.logo.upload":   { bg: "#1e3a5f", color: "#93c5fd" },
  "user.password.change": { bg: "#451a03", color: "#fbbf24" },
  "broadcast.send":       { bg: "#1a1a3d", color: "#a78bfa" },
};

function actionBadge(action: string) {
  const style = ACTION_COLORS[action] ?? { bg: "#1f2937", color: "#9ca3af" };
  return (
    <span className="text-xs font-semibold rounded-full px-2.5 py-0.5 whitespace-nowrap"
      style={{ background: style.bg, color: style.color }}>
      {action}
    </span>
  );
}

function metaSummary(meta: Record<string, unknown> | null): string {
  if (!meta) return "—";
  const parts: string[] = [];
  if (meta.name)           parts.push(`name: ${meta.name}`);
  if (meta.email)          parts.push(`email: ${meta.email}`);
  if (meta.role)           parts.push(`role: ${meta.role}`);
  if (meta.teamName)       parts.push(`team: ${meta.teamName}`);
  if (meta.playerName)     parts.push(`player: ${meta.playerName}`);
  if (meta.recipientCount) parts.push(`recipients: ${meta.recipientCount}`);
  if (meta.sent !== undefined) parts.push(`sent: ${meta.sent}`);
  return parts.join(" · ") || JSON.stringify(meta).slice(0, 80);
}

const UNIQUE_ACTIONS = Object.keys(ACTION_COLORS).sort();

const dim  = { color: "var(--sh-muted)" };
const head = { color: "var(--sh-text)" };
const card = { borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" };

export function AuditLogView() {
  const [logs,    setLogs]    = useState<AuditEntry[]>([]);
  const [total,   setTotal]   = useState(0);
  const [pages,   setPages]   = useState(1);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(true);

  const [q,      setQ]      = useState("");
  const [action, setAction] = useState("");
  const [from,   setFrom]   = useState("");
  const [to,     setTo]     = useState("");

  const fetchLogs = useCallback(async (p: number) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p) });
    if (q)      params.set("q",      q);
    if (action) params.set("action", action);
    if (from)   params.set("from",   from);
    if (to)     params.set("to",     to);

    const res  = await fetch(`/api/admin/audit?${params}`);
    const data = await res.json();
    setLogs(data.logs ?? []);
    setTotal(data.total ?? 0);
    setPages(data.pages ?? 1);
    setPage(p);
    setLoading(false);
  }, [q, action, from, to]);

  useEffect(() => { fetchLogs(1); }, [fetchLogs]);

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search user or league…"
          className="flex-1 min-w-48 rounded-xl border px-4 py-2 text-sm outline-none"
          style={{ background: "var(--sh-bg-card2)", borderColor: "var(--sh-border)", color: "var(--sh-text)" }}
        />
        <select value={action} onChange={(e) => setAction(e.target.value)}
          className="rounded-xl border px-3 py-2 text-sm outline-none"
          style={{ background: "var(--sh-bg-card2)", borderColor: "var(--sh-border)", color: "var(--sh-text)" }}>
          <option value="">All actions</option>
          {UNIQUE_ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
          className="rounded-xl border px-3 py-2 text-sm outline-none"
          style={{ background: "var(--sh-bg-card2)", borderColor: "var(--sh-border)", color: "var(--sh-text)" }} />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
          className="rounded-xl border px-3 py-2 text-sm outline-none"
          style={{ background: "var(--sh-bg-card2)", borderColor: "var(--sh-border)", color: "var(--sh-text)" }} />
      </div>

      {/* Count */}
      <p className="text-xs" style={dim}>{total} event{total !== 1 ? "s" : ""} found</p>

      {/* Table */}
      <div className="rounded-2xl border overflow-hidden" style={card}>
        {loading ? (
          <p className="px-6 py-10 text-center text-sm" style={dim}>Loading…</p>
        ) : logs.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm" style={dim}>No audit events found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--sh-border)" }}>
                  {["Time", "User", "Action", "League", "Details"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={dim}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="transition-colors" style={{ borderBottom: "1px solid var(--sh-border)" }}>
                    <td className="px-4 py-3 text-xs whitespace-nowrap" style={dim}>
                      {new Date(log.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      <br />
                      <span>{new Date(log.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-sm" style={head}>{log.userName ?? "—"}</p>
                      <p className="text-xs" style={dim}>{log.userEmail ?? ""}</p>
                    </td>
                    <td className="px-4 py-3">{actionBadge(log.action)}</td>
                    <td className="px-4 py-3 text-xs" style={head}>{log.leagueName ?? "—"}</td>
                    <td className="px-4 py-3 text-xs max-w-xs truncate" style={dim} title={JSON.stringify(log.metadata)}>
                      {metaSummary(log.metadata)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => fetchLogs(page - 1)} disabled={page <= 1}
            className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-40"
            style={{ borderColor: "var(--sh-border2)", color: "var(--sh-primary)", background: "transparent" }}>
            ← Prev
          </button>
          <span className="text-sm" style={dim}>Page {page} of {pages}</span>
          <button onClick={() => fetchLogs(page + 1)} disabled={page >= pages}
            className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-40"
            style={{ borderColor: "var(--sh-border2)", color: "var(--sh-primary)", background: "transparent" }}>
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
