"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface League { id: string; name: string }
interface Ticket {
  id: string; title: string; category: string; status: string;
  createdAt: string; updatedAt: string;
  league: { id: string; name: string } | null;
  assignedTo: { id: string; name: string | null } | null;
  _count: { messages: number };
}

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

interface Props { leagues: League[] }

export function MyTicketsView({ leagues }: Props) {
  const [tickets, setTickets]     = useState<Ticket[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const [form, setForm] = useState({ title: "", body: "", category: "SYSTEM_ISSUE", leagueId: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/support/tickets/my");
    if (res.ok) setTickets(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setSubmitError("");
    const res = await fetch("/api/support/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        body: form.body,
        category: form.category,
        leagueId: form.category === "LEAGUE_ISSUE" && form.leagueId ? form.leagueId : undefined,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const d = await res.json();
      setSubmitError(d.error ?? "Something went wrong");
      return;
    }
    setShowCreate(false);
    setForm({ title: "", body: "", category: "SYSTEM_ISSUE", leagueId: "" });
    load();
  }

  const input = "w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-green-500";
  const inputStyle = { borderColor: "var(--sh-border)", background: "var(--sh-bg-card2)", color: "var(--sh-text)" };

  return (
    <div className="min-h-screen" style={{ background: "var(--sh-bg-page)" }}>
      <header className="border-b sticky top-0 z-10" style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-header)" }}>
        <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-sm hover:opacity-80" style={{ color: "var(--sh-primary)" }}>← Dashboard</Link>
            <span style={{ color: "var(--sh-border2)" }}>|</span>
            <span className="font-semibold" style={{ color: "var(--sh-text)" }}>🎫 My Support Tickets</span>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 rounded-lg font-semibold text-sm"
            style={{ background: "linear-gradient(135deg,#16a34a,#15803d)", color: "#fff" }}
          >
            + New Ticket
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">

        {/* Create ticket modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
            <div className="rounded-2xl border w-full max-w-lg p-6 space-y-4" style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" }}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold" style={{ color: "var(--sh-text)" }}>New Support Ticket</h2>
                <button onClick={() => setShowCreate(false)} className="text-xl leading-none" style={{ color: "var(--sh-muted)" }}>×</button>
              </div>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "var(--sh-primary)" }}>Category</label>
                  <select required className={input} style={inputStyle} value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value, leagueId: "" }))}>
                    <option value="SYSTEM_ISSUE">System Issue</option>
                    <option value="LEAGUE_ISSUE">League Issue</option>
                  </select>
                </div>

                {form.category === "LEAGUE_ISSUE" && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "var(--sh-primary)" }}>League</label>
                    <select className={input} style={inputStyle} value={form.leagueId}
                      onChange={e => setForm(f => ({ ...f, leagueId: e.target.value }))}>
                      <option value="">— Select league (optional) —</option>
                      {leagues.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "var(--sh-primary)" }}>Title</label>
                  <input required className={input} style={inputStyle} placeholder="Brief description of the issue"
                    value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "var(--sh-primary)" }}>Description</label>
                  <textarea required rows={5} className={input} style={{ ...inputStyle, resize: "vertical" }}
                    placeholder="Describe the issue in detail…"
                    value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} />
                </div>

                {submitError && <p className="text-sm" style={{ color: "var(--sh-danger)" }}>{submitError}</p>}

                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setShowCreate(false)}
                    className="px-4 py-2 rounded-lg text-sm border" style={{ borderColor: "var(--sh-border)", color: "var(--sh-muted)" }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={submitting}
                    className="px-5 py-2 rounded-lg font-semibold text-sm disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg,#16a34a,#15803d)", color: "#fff" }}>
                    {submitting ? "Submitting…" : "Submit Ticket"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Ticket list */}
        {loading ? (
          <div className="text-center py-20 text-sm" style={{ color: "var(--sh-muted)" }}>Loading…</div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-20 rounded-2xl border" style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" }}>
            <div className="text-5xl mb-4">🎫</div>
            <p className="text-lg font-semibold mb-1" style={{ color: "var(--sh-text)" }}>No tickets yet</p>
            <p className="text-sm mb-6" style={{ color: "var(--sh-muted)" }}>Open a ticket whenever you need help.</p>
            <button onClick={() => setShowCreate(true)}
              className="px-6 py-2.5 rounded-lg font-semibold text-sm"
              style={{ background: "linear-gradient(135deg,#16a34a,#15803d)", color: "#fff" }}>
              + New Ticket
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map(ticket => (
              <Link key={ticket.id} href={`/support/tickets/${ticket.id}`} className="block group">
                <div className="rounded-2xl border p-5 transition-all group-hover:shadow-md"
                  style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold truncate" style={{ color: "var(--sh-text)" }}>{ticket.title}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs px-2 py-0.5 rounded-full border font-medium" style={{ color: "var(--sh-muted)", borderColor: "var(--sh-border2)" }}>
                          {CAT_LABEL[ticket.category]}
                        </span>
                        {ticket.league && (
                          <span className="text-xs" style={{ color: "var(--sh-muted)" }}>{ticket.league.name}</span>
                        )}
                        <span className="text-xs" style={{ color: "var(--sh-muted)" }}>
                          {new Date(ticket.updatedAt).toLocaleDateString()}
                        </span>
                        {ticket._count.messages > 0 && (
                          <span className="text-xs" style={{ color: "var(--sh-muted)" }}>💬 {ticket._count.messages}</span>
                        )}
                      </div>
                    </div>
                    <span className={`shrink-0 text-xs px-2.5 py-1 rounded-full border font-semibold ${STATUS_COLORS[ticket.status]}`}>
                      {STATUS_LABEL[ticket.status]}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
