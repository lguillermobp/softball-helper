"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

interface TicketRow {
  id: string; title: string; category: string; status: string;
  createdAt: string; updatedAt: string;
  league: { id: string; name: string } | null;
  createdBy: { id: string; name: string | null; email: string };
  assignedTo: { id: string; name: string | null; email: string } | null;
  _count: { messages: number };
}
interface Technician { id: string; name: string | null; email: string }

const STATUS_COLORS: Record<string, string> = {
  OPEN:        "bg-blue-500/20 text-blue-300 border-blue-500/30",
  IN_PROGRESS: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  RESOLVED:    "bg-green-500/20 text-green-300 border-green-500/30",
  CLOSED:      "bg-gray-500/20 text-gray-400 border-gray-500/30",
};
const STATUS_LABEL: Record<string, string> = {
  OPEN: "Open", IN_PROGRESS: "In Progress", RESOLVED: "Resolved", CLOSED: "Closed",
};
const CAT_LABEL: Record<string, string> = {
  LEAGUE_ISSUE: "League Issue", SYSTEM_ISSUE: "System Issue",
};

interface Props {
  tickets: TicketRow[];
  technicians: Technician[];
  isMasterAdmin: boolean;
}

export function SupportDashboardView({ tickets: initial, technicians, isMasterAdmin }: Props) {
  const [tickets, setTickets]     = useState(initial);
  const [search, setSearch]       = useState("");
  const [statusFilter, setStatus] = useState("ALL");
  const [catFilter, setCat]       = useState("ALL");
  const [assignFilter, setAssign] = useState("ALL");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter(t => {
      if (statusFilter !== "ALL" && t.status !== statusFilter) return false;
      if (catFilter    !== "ALL" && t.category !== catFilter)  return false;
      if (assignFilter !== "ALL") {
        if (assignFilter === "UNASSIGNED" && t.assignedTo) return false;
        if (assignFilter !== "UNASSIGNED" && t.assignedTo?.id !== assignFilter) return false;
      }
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        (t.createdBy.name ?? t.createdBy.email).toLowerCase().includes(q) ||
        (t.league?.name ?? "").toLowerCase().includes(q)
      );
    });
  }, [tickets, search, statusFilter, catFilter, assignFilter]);

  const counts = {
    open:       tickets.filter(t => t.status === "OPEN").length,
    inProgress: tickets.filter(t => t.status === "IN_PROGRESS").length,
    resolved:   tickets.filter(t => t.status === "RESOLVED").length,
    closed:     tickets.filter(t => t.status === "CLOSED").length,
  };

  async function handleQuickStatus(ticketId: string, status: string) {
    const res = await fetch(`/api/support/tickets/${ticketId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status } : t));
    }
  }

  const selectStyle = {
    borderColor: "var(--sh-border)", background: "var(--sh-bg-card2)", color: "var(--sh-text)",
    padding: "6px 10px", borderRadius: "8px", fontSize: "13px", border: "1px solid",
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--sh-bg-page)" }}>
      <header className="border-b sticky top-0 z-10" style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-header)" }}>
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-3">
          <Link href="/dashboard" className="text-sm hover:opacity-80" style={{ color: "var(--sh-primary)" }}>← Dashboard</Link>
          <span style={{ color: "var(--sh-border2)" }}>|</span>
          <span className="font-semibold" style={{ color: "var(--sh-text)" }}>🎫 Support Dashboard</span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Open",        value: counts.open,       color: "#60a5fa", filter: "OPEN" },
            { label: "In Progress", value: counts.inProgress, color: "#facc15", filter: "IN_PROGRESS" },
            { label: "Resolved",    value: counts.resolved,   color: "#4ade80", filter: "RESOLVED" },
            { label: "Closed",      value: counts.closed,     color: "#9ca3af", filter: "CLOSED" },
          ].map(s => (
            <button key={s.label}
              onClick={() => setStatus(prev => prev === s.filter ? "ALL" : s.filter)}
              className="rounded-2xl border p-4 text-center transition-all hover:opacity-80"
              style={{
                borderColor: statusFilter === s.filter ? s.color : "var(--sh-border)",
                background: "var(--sh-bg-card)",
                outline: statusFilter === s.filter ? `2px solid ${s.color}` : "none",
              }}>
              <p className="text-3xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs mt-1" style={{ color: "var(--sh-muted)" }}>{s.label}</p>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search title, user, league…"
            className="flex-1 min-w-[180px] px-3 py-1.5 rounded-lg border text-sm focus:outline-none"
            style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card2)", color: "var(--sh-text)" }}
          />
          <select value={catFilter} onChange={e => setCat(e.target.value)} style={selectStyle}>
            <option value="ALL">All categories</option>
            <option value="LEAGUE_ISSUE">League Issue</option>
            <option value="SYSTEM_ISSUE">System Issue</option>
          </select>
          {isMasterAdmin && (
            <select value={assignFilter} onChange={e => setAssign(e.target.value)} style={selectStyle}>
              <option value="ALL">All assignees</option>
              <option value="UNASSIGNED">Unassigned</option>
              {technicians.map(t => (
                <option key={t.id} value={t.id}>{t.name ?? t.email}</option>
              ))}
            </select>
          )}
          <span className="text-xs" style={{ color: "var(--sh-muted)" }}>
            {filtered.length} / {tickets.length} tickets
          </span>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="rounded-2xl border py-16 text-center text-sm"
            style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card)", color: "var(--sh-muted)" }}>
            No tickets match your filters.
          </div>
        ) : (
          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--sh-border)", background: "var(--sh-bg-card2)" }}>
                    {["Title", "Category", "League", "From", "Assigned", "Msgs", "Status", "Updated", ""].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
                        style={{ color: "var(--sh-muted)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(t => (
                    <tr key={t.id} className="transition-colors hover:bg-white/5"
                      style={{ borderBottom: "1px solid var(--sh-border)" }}>
                      <td className="px-4 py-3 font-medium max-w-[200px]" style={{ color: "var(--sh-text)" }}>
                        <span className="truncate block">{t.title}</span>
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: "var(--sh-muted)" }}>
                        {CAT_LABEL[t.category]}
                      </td>
                      <td className="px-4 py-3 text-xs max-w-[120px]" style={{ color: "var(--sh-muted)" }}>
                        <span className="truncate block">{t.league?.name ?? "—"}</span>
                      </td>
                      <td className="px-4 py-3 text-xs max-w-[120px]" style={{ color: "var(--sh-muted)" }}>
                        <span className="truncate block">{t.createdBy.name ?? t.createdBy.email}</span>
                      </td>
                      <td className="px-4 py-3 text-xs max-w-[120px]" style={{ color: "var(--sh-muted)" }}>
                        <span className="truncate block">{t.assignedTo?.name ?? t.assignedTo?.email ?? "—"}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-center" style={{ color: "var(--sh-muted)" }}>
                        {t._count.messages > 0 ? `💬 ${t._count.messages}` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {isMasterAdmin ? (
                          <select
                            value={t.status}
                            onChange={e => handleQuickStatus(t.id, e.target.value)}
                            className="text-xs rounded-lg border px-2 py-1 focus:outline-none"
                            style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card2)", color: "var(--sh-text)" }}
                          >
                            {["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"].map(s => (
                              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${STATUS_COLORS[t.status]}`}>
                            {STATUS_LABEL[t.status]}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: "var(--sh-muted)" }}>
                        {new Date(t.updatedAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/support/tickets/${t.id}`}
                          className="text-xs font-semibold hover:opacity-80 whitespace-nowrap"
                          style={{ color: "var(--sh-primary)" }}>
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
