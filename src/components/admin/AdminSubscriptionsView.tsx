"use client";

import { useState, useEffect } from "react";

interface Plan { id: string; name: string; price: number; maxGames: number }
interface Subscription {
  id: string;
  planId: string;
  maxGames: number;
  startDate: string;
  endDate: string;
  status: string;
  cancelledAt: string | null;
  note: string | null;
  stripeSubscriptionId: string | null;
  plan: { id: string; name: string; price: number; maxGames: number };
}
interface LeagueSummary {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan: { name: string };
  activeSub: Subscription | null;
}

const dim  = { color: "var(--sh-muted)" };
const head = { color: "var(--sh-text)" };
const card = { borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" };
const inputCls = "w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-green-500";
const inputStyle = { background: "var(--sh-bg-card2)", borderColor: "var(--sh-border)", color: "var(--sh-text)" };

function statusBadge(s: string) {
  if (s === "ACTIVE")        return { bg: "#14532d22", color: "#22c55e", label: "Active" };
  if (s === "EXPIRED")       return { bg: "#7f1d1d22", color: "#f87171", label: "Expired" };
  if (s === "LIMIT_REACHED") return { bg: "#78350f22", color: "#f59e0b", label: "Limit Reached" };
  if (s === "CANCELLED")     return { bg: "#1f293722", color: "#9ca3af", label: "Cancelled" };
  return { bg: "#1f293722", color: "#9ca3af", label: s };
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString();
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function oneYearIso() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

interface SubFormState {
  planId: string;
  startDate: string;
  endDate: string;
  maxGames: string;
  note: string;
  status: string;
}

function LeagueSubPanel({ league, plans, onClose }: {
  league: LeagueSummary;
  plans: Plan[];
  onClose: () => void;
}) {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SubFormState>({
    planId: plans[0]?.id ?? "",
    startDate: todayIso(),
    endDate: oneYearIso(),
    maxGames: "100",
    note: "",
    status: "ACTIVE",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/admin/leagues/${league.id}/subscriptions`);
    if (res.ok) {
      const data = await res.json();
      setSubs(data.subscriptions);
    }
    setLoading(false);
    setLoaded(true);
  }

  // Load on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  function openCreate() {
    setCreating(true);
    setEditingId(null);
    setError("");
    setForm({
      planId: plans[0]?.id ?? "",
      startDate: todayIso(),
      endDate: oneYearIso(),
      maxGames: plans[0]?.maxGames?.toString() ?? "100",
      note: "",
      status: "ACTIVE",
    });
  }

  function openEdit(sub: Subscription) {
    setEditingId(sub.id);
    setCreating(false);
    setError("");
    setForm({
      planId: sub.planId,
      startDate: sub.startDate.slice(0, 10),
      endDate: sub.endDate.slice(0, 10),
      maxGames: sub.maxGames.toString(),
      note: sub.note ?? "",
      status: sub.status,
    });
  }

  function cancelForm() { setCreating(false); setEditingId(null); setError(""); }

  async function save() {
    setSaving(true); setError("");
    const isEdit = !!editingId;
    const url = `/api/admin/leagues/${league.id}/subscriptions`;
    const method = isEdit ? "PATCH" : "POST";
    const body = isEdit
      ? { subscriptionId: editingId, ...form, maxGames: parseInt(form.maxGames) }
      : { ...form, maxGames: parseInt(form.maxGames) };
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error ?? "Failed"); return; }
    const updated = await res.json();
    if (isEdit) {
      setSubs(s => s.map(x => x.id === editingId ? updated : x));
    } else {
      setSubs(s => [updated, ...s.map(x => x.status === "ACTIVE" ? { ...x, status: "CANCELLED" } : x)]);
    }
    cancelForm();
  }

  // Auto-fill maxGames when plan changes
  function onPlanChange(planId: string) {
    const plan = plans.find(p => p.id === planId);
    setForm(f => ({ ...f, planId, maxGames: plan?.maxGames?.toString() ?? f.maxGames }));
  }

  const SubForm = (
    <div className="rounded-xl border p-4 space-y-3 mb-4" style={{ borderColor: "var(--sh-border2)", background: "var(--sh-bg-card2)" }}>
      <p className="text-sm font-bold" style={head}>{editingId ? "Edit subscription" : "New subscription"}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={dim}>Plan</label>
          <select value={form.planId} onChange={e => onPlanChange(e.target.value)} className={inputCls} style={inputStyle}>
            {plans.map(p => <option key={p.id} value={p.id}>{p.name} (${p.price}/yr, {p.maxGames} games)</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={dim}>Max games</label>
          <input type="number" value={form.maxGames} onChange={e => setForm(f => ({ ...f, maxGames: e.target.value }))} className={inputCls} style={inputStyle} />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={dim}>Start date</label>
          <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className={inputCls} style={inputStyle} />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={dim}>End date</label>
          <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} className={inputCls} style={inputStyle} />
        </div>
        {editingId && (
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={dim}>Status</label>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inputCls} style={inputStyle}>
              <option value="ACTIVE">Active</option>
              <option value="EXPIRED">Expired</option>
              <option value="LIMIT_REACHED">Limit Reached</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        )}
        <div className={editingId ? "" : "sm:col-span-2"}>
          <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={dim}>Note (optional)</label>
          <input type="text" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="e.g. Promo, manual grant…" className={inputCls} style={inputStyle} />
        </div>
      </div>
      {error && <p className="text-xs" style={{ color: "#f87171" }}>{error}</p>}
      <div className="flex gap-2 pt-1">
        <button onClick={save} disabled={saving}
          className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
          style={{ background: "linear-gradient(135deg,#16a34a,#15803d)", color: "#fff" }}>
          {saving ? "Saving…" : editingId ? "Save changes" : "Create subscription"}
        </button>
        <button onClick={cancelForm}
          className="px-4 py-2 rounded-lg text-sm border"
          style={{ borderColor: "var(--sh-border2)", color: "var(--sh-muted)", background: "transparent" }}>
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <div className="rounded-2xl border p-5 space-y-4" style={card}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold" style={head}>{league.name}</h3>
          <p className="text-xs" style={dim}>Plan: {league.plan.name} · Status: {league.status}</p>
        </div>
        <div className="flex gap-2">
          {!creating && !editingId && (
            <button onClick={openCreate}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold"
              style={{ background: "linear-gradient(135deg,#16a34a,#15803d)", color: "#fff" }}>
              + New subscription
            </button>
          )}
          <button onClick={onClose}
            className="text-xs px-3 py-1.5 rounded-lg border"
            style={{ borderColor: "var(--sh-border2)", color: "var(--sh-muted)", background: "transparent" }}>
            Close
          </button>
        </div>
      </div>

      {(creating || editingId) && SubForm}

      {loading && <p className="text-sm text-center py-4" style={dim}>Loading…</p>}

      {loaded && subs.length === 0 && !creating && (
        <p className="text-sm text-center py-4" style={dim}>No subscription history for this league.</p>
      )}

      {subs.length > 0 && (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--sh-border2)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--sh-border)" }}>
                {["Plan", "Games", "Start", "End", "Status", "Note", ""].map((h, i) => (
                  <th key={i} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider" style={dim}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {subs.map(sub => {
                const badge = statusBadge(sub.status);
                return (
                  <tr key={sub.id} style={{ borderBottom: "1px solid var(--sh-border)" }}>
                    <td className="px-3 py-2 font-medium" style={head}>{sub.plan.name}</td>
                    <td className="px-3 py-2" style={dim}>{sub.maxGames}</td>
                    <td className="px-3 py-2" style={dim}>{fmtDate(sub.startDate)}</td>
                    <td className="px-3 py-2" style={dim}>{fmtDate(sub.endDate)}</td>
                    <td className="px-3 py-2">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: badge.bg, color: badge.color }}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs" style={dim}>{sub.note ?? "—"}</td>
                    <td className="px-3 py-2">
                      <button onClick={() => openEdit(sub)}
                        className="text-xs px-2 py-1 rounded-md border hover:opacity-80"
                        style={{ borderColor: "var(--sh-border2)", color: "var(--sh-primary)", background: "transparent" }}>
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function AdminSubscriptionsView({ leagues, plans }: { leagues: LeagueSummary[]; plans: Plan[] }) {
  const [search, setSearch] = useState("");
  const [openLeagueId, setOpenLeagueId] = useState<string | null>(null);

  const filtered = leagues.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase())
  );

  const openLeague = leagues.find(l => l.id === openLeagueId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={head}>Subscriptions</h1>
        <p className="text-sm mt-1" style={dim}>Manage per-league subscription history</p>
      </div>

      {openLeague ? (
        <LeagueSubPanel
          league={openLeague}
          plans={plans}
          onClose={() => setOpenLeagueId(null)}
        />
      ) : (
        <>
          <input
            type="text"
            placeholder="Search leagues…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full max-w-sm rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-green-500"
            style={inputStyle}
          />

          <div className="rounded-2xl border overflow-hidden" style={card}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--sh-border)" }}>
                  {["League", "Plan", "Status", "Active Subscription", "Expires", ""].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={dim}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(league => {
                  const sub = league.activeSub;
                  const badge = sub ? statusBadge(sub.status) : { bg: "#1f293722", color: "#9ca3af", label: "None" };
                  return (
                    <tr key={league.id} className="transition-colors hover:brightness-110"
                      style={{ borderBottom: "1px solid var(--sh-border)" }}>
                      <td className="px-4 py-3 font-semibold" style={head}>{league.name}</td>
                      <td className="px-4 py-3 text-xs" style={dim}>{league.plan.name}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium rounded-full px-2 py-0.5"
                          style={{ background: league.status === "ACTIVE" ? "#14532d22" : "#7f1d1d22", color: league.status === "ACTIVE" ? "#22c55e" : "#f87171" }}>
                          {league.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: badge.bg, color: badge.color }}>
                          {sub ? `${sub.plan.name} · ${sub.maxGames} games` : badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs" style={dim}>
                        {sub ? fmtDate(sub.endDate) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setOpenLeagueId(league.id)}
                          className="text-xs px-3 py-1.5 rounded-lg border hover:opacity-80"
                          style={{ borderColor: "var(--sh-border2)", color: "var(--sh-primary)", background: "transparent" }}>
                          Manage
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
