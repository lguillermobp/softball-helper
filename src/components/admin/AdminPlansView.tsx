"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Plan {
  id: string;
  name: string;
  price: number;
  maxTeams: number;
  maxSeasons: number;
  maxPlayers: number;
  isActive: boolean;
  stripePriceId: string | null;
  leagueCount: number;
}

const dim   = { color: "var(--sh-muted)" };
const head  = { color: "var(--sh-text)" };
const card  = { borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" };
const input = "w-full rounded-md border px-3 py-2 text-sm outline-none";
const inputStyle = { background: "var(--sh-bg-card2)", borderColor: "var(--sh-border)", color: "var(--sh-text)" };

const EMPTY: Omit<Plan, "id" | "leagueCount"> = {
  name: "", price: 0, maxTeams: 4, maxSeasons: 1, maxPlayers: 40,
  isActive: true, stripePriceId: null,
};

export function AdminPlansView({ initialPlans }: { initialPlans: Plan[] }) {
  const router = useRouter();
  const [plans, setPlans]   = useState<Plan[]>(initialPlans);
  const [editing, setEditing] = useState<string | null>(null);   // plan id being edited
  const [creating, setCreating] = useState(false);
  const [form, setForm]     = useState<Omit<Plan, "id" | "leagueCount">>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  function openEdit(plan: Plan) {
    setEditing(plan.id);
    setCreating(false);
    setError("");
    setForm({
      name: plan.name, price: plan.price,
      maxTeams: plan.maxTeams, maxSeasons: plan.maxSeasons, maxPlayers: plan.maxPlayers,
      isActive: plan.isActive, stripePriceId: plan.stripePriceId,
    });
  }

  function openCreate() {
    setCreating(true);
    setEditing(null);
    setError("");
    setForm(EMPTY);
  }

  function cancel() { setEditing(null); setCreating(false); setError(""); }

  function field(key: keyof typeof form, label: string, type = "text", hint?: string) {
    const val = form[key];
    return (
      <div className="space-y-1">
        <label className="text-xs font-semibold uppercase tracking-wider" style={dim}>{label}</label>
        {key === "isActive" ? (
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={!!form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              className="w-4 h-4 accent-green-500" />
            <span className="text-sm" style={head}>Active (available to assign)</span>
          </label>
        ) : (
          <input
            type={type}
            value={typeof val === "boolean" ? "" : (val ?? "")}
            placeholder={hint}
            onChange={(e) => setForm((f) => ({ ...f, [key]: type === "number" ? Number(e.target.value) : e.target.value }))}
            className={input}
            style={inputStyle}
          />
        )}
      </div>
    );
  }

  async function save() {
    setLoading(true);
    setError("");
    const url    = creating ? "/api/admin/plans" : `/api/admin/plans/${editing}`;
    const method = creating ? "POST" : "PATCH";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setLoading(false);
    if (!res.ok) { const d = await res.json(); setError(d.error ?? "Failed"); return; }
    cancel();
    router.refresh();
    const updated = await fetch("/api/admin/plans").then((r) => r.json());
    setPlans(updated);
  }

  async function deletePlan(planId: string) {
    setLoading(true);
    const res = await fetch(`/api/admin/plans/${planId}`, { method: "DELETE" });
    setLoading(false);
    setDeleteConfirm(null);
    if (!res.ok) { const d = await res.json(); setError(d.error ?? "Cannot delete"); return; }
    router.refresh();
    setPlans((p) => p.filter((x) => x.id !== planId));
  }

  const FormPanel = (
    <div className="rounded-2xl border p-6 space-y-4 mb-6" style={card}>
      <h2 className="text-base font-bold" style={head}>{creating ? "New plan" : "Edit plan"}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {field("name",          "Plan name",        "text",   "e.g. Basic")}
        {field("price",         "Monthly price ($)", "number", "9")}
        {field("maxTeams",      "Max teams",         "number", "4")}
        {field("maxSeasons",    "Max seasons",       "number", "1")}
        {field("maxPlayers",    "Max players",       "number", "40")}
        {field("stripePriceId", "Stripe Price ID",   "text",   "price_xxx (optional)")}
      </div>
      {field("isActive", "Active")}
      {error && <p className="text-sm" style={{ color: "#f87171" }}>{error}</p>}
      <div className="flex gap-2 pt-2">
        <button onClick={save} disabled={loading}
          className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
          style={{ background: "linear-gradient(135deg,#16a34a,#15803d)", color: "#fff" }}>
          {loading ? "Saving…" : creating ? "Create plan" : "Save changes"}
        </button>
        <button onClick={cancel}
          className="px-4 py-2 rounded-lg text-sm border"
          style={{ borderColor: "var(--sh-border2)", color: "var(--sh-muted)", background: "transparent" }}>
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={head}>Plans</h1>
          <p className="text-sm mt-1" style={dim}>Manage subscription plans and their limits</p>
        </div>
        {!creating && !editing && (
          <button onClick={openCreate}
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: "linear-gradient(135deg,#16a34a,#15803d)", color: "#fff" }}>
            + New plan
          </button>
        )}
      </div>

      {(creating || editing) && FormPanel}

      <div className="rounded-2xl border overflow-hidden" style={card}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--sh-border)" }}>
              {["Plan", "Price/mo", "Teams", "Seasons", "Players", "Leagues", "Status", "Stripe ID", ""].map((h, i) => (
                <th key={i} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={dim}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <tr key={plan.id} style={{ borderBottom: "1px solid #0f2310" }}>
                <td className="px-4 py-3 font-semibold" style={head}>{plan.name}</td>
                <td className="px-4 py-3" style={dim}>${plan.price}/mo</td>
                <td className="px-4 py-3" style={dim}>{plan.maxTeams >= 9999 ? "∞" : plan.maxTeams}</td>
                <td className="px-4 py-3" style={dim}>{plan.maxSeasons >= 9999 ? "∞" : plan.maxSeasons}</td>
                <td className="px-4 py-3" style={dim}>{plan.maxPlayers >= 9999 ? "∞" : plan.maxPlayers}</td>
                <td className="px-4 py-3 font-semibold" style={{ color: "var(--sh-primary)" }}>{plan.leagueCount}</td>
                <td className="px-4 py-3">
                  <span className="text-xs font-semibold rounded-full px-2.5 py-0.5"
                    style={plan.isActive
                      ? { background: "#14532d", color: "#4ade80" }
                      : { background: "#1f2937", color: "#9ca3af" }}>
                    {plan.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs font-mono" style={dim}>
                  {plan.stripePriceId
                    ? <span title={plan.stripePriceId}>{plan.stripePriceId.slice(0, 14)}…</span>
                    : <span style={{ color: "#374151" }}>—</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button onClick={() => openEdit(plan)}
                      className="text-xs px-2 py-1 rounded-md border hover:opacity-80"
                      style={{ borderColor: "var(--sh-border2)", color: "var(--sh-primary)", background: "transparent" }}>
                      Edit
                    </button>
                    {deleteConfirm === plan.id ? (
                      <>
                        <button onClick={() => deletePlan(plan.id)} disabled={loading}
                          className="text-xs px-2 py-1 rounded-md border hover:opacity-80 disabled:opacity-50"
                          style={{ borderColor: "#7f1d1d", color: "#f87171", background: "transparent" }}>
                          Confirm
                        </button>
                        <button onClick={() => setDeleteConfirm(null)}
                          className="text-xs px-2 py-1 rounded-md border hover:opacity-80"
                          style={{ borderColor: "var(--sh-border2)", color: "var(--sh-muted)", background: "transparent" }}>
                          ✕
                        </button>
                      </>
                    ) : (
                      <button onClick={() => setDeleteConfirm(plan.id)}
                        className="text-xs px-2 py-1 rounded-md border hover:opacity-80"
                        style={{ borderColor: "var(--sh-border2)", color: "#f87171", background: "transparent" }}>
                        Delete
                      </button>
                    )}
                  </div>
                  {error && deleteConfirm === null && <p className="text-xs mt-1" style={{ color: "#f87171" }}>{error}</p>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
