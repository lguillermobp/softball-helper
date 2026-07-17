"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Coupon {
  id:                    string;
  code:                  string;
  type:                  "GENERAL" | "PERSONALIZED";
  email:                 string | null;
  percentOff:            number;
  duration:              "ONCE" | "FOREVER";
  expiresAt:             string;
  maxRedemptions:        number | null;
  redemptionCount:       number;
  active:                boolean;
  stripePromotionCodeId: string | null;
  createdAt:             string;
  leagueCount:           number;
}

const dim        = { color: "var(--sh-muted)" };
const head       = { color: "var(--sh-text)" };
const card       = { borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" };
const inputStyle = { background: "var(--sh-bg-card2)", borderColor: "var(--sh-border)", color: "var(--sh-text)" };
const inputCls   = "w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500";

const EMPTY_FORM = {
  code:           "",
  type:           "GENERAL" as "GENERAL" | "PERSONALIZED",
  email:          "",
  percentOff:     20,
  duration:       "ONCE" as "ONCE" | "FOREVER",
  expiresAt:      "",
  maxRedemptions: "" as string | number,
};

function statusBadge(coupon: Coupon) {
  const expired = new Date(coupon.expiresAt) < new Date();
  const maxed   = coupon.maxRedemptions !== null && coupon.redemptionCount >= coupon.maxRedemptions;
  if (!coupon.active) return { label: "Inactive", color: "rgba(239,68,68,0.15)", text: "#ef4444" };
  if (expired)        return { label: "Expired",  color: "rgba(251,191,36,0.15)", text: "#fbbf24" };
  if (maxed)          return { label: "Maxed",    color: "rgba(251,191,36,0.15)", text: "#fbbf24" };
  return { label: "Active", color: "rgba(74,222,128,0.15)", text: "#4ade80" };
}

export function AdminCouponsView({ initialCoupons }: { initialCoupons: Coupon[] }) {
  const router = useRouter();
  const [coupons, setCoupons]     = useState<Coupon[]>(initialCoupons);
  const [creating, setCreating]   = useState(false);
  const [form, setForm]           = useState({ ...EMPTY_FORM });
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  function openCreate() { setCreating(true); setError(""); setForm({ ...EMPTY_FORM }); }
  function cancel()     { setCreating(false); setError(""); }

  function setField<K extends keyof typeof EMPTY_FORM>(k: K, v: typeof EMPTY_FORM[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function handleCreate() {
    setError("");
    setLoading(true);
    const res = await fetch("/api/admin/coupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        maxRedemptions: form.maxRedemptions === "" ? null : Number(form.maxRedemptions),
      }),
    });
    setLoading(false);
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Failed to create coupon"); return; }
    setCoupons(prev => [{ ...data.coupon, leagueCount: 0 }, ...prev]);
    setCreating(false);
  }

  async function toggleActive(coupon: Coupon) {
    const res = await fetch(`/api/admin/coupons/${coupon.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !coupon.active }),
    });
    if (!res.ok) return;
    setCoupons(prev => prev.map(c => c.id === coupon.id ? { ...c, active: !c.active } : c));
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/admin/coupons/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) { alert(data.error ?? "Failed to delete"); return; }
    setCoupons(prev => prev.filter(c => c.id !== id));
    setDeleteConfirm(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={head}>Coupons</h1>
          <p className="text-sm mt-1" style={dim}>Manage discount codes for new leagues at subscription time</p>
        </div>
        {!creating && (
          <button
            onClick={openCreate}
            className="text-sm px-4 py-2 rounded-lg font-semibold text-white"
            style={{ background: "var(--sh-primary-dark, #16a34a)" }}
          >
            + New Coupon
          </button>
        )}
      </div>

      {/* ── Create form ── */}
      {creating && (
        <div className="rounded-xl p-5 space-y-4" style={{ ...card, border: "1px solid var(--sh-border)" }}>
          <h2 className="text-sm font-bold uppercase tracking-wider" style={dim}>New Coupon</h2>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider" style={dim}>Code</label>
              <input
                className={inputCls} style={inputStyle}
                placeholder="SUMMER25"
                value={form.code}
                onChange={e => setField("code", e.target.value.toUpperCase())}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider" style={dim}>Discount (%)</label>
              <input
                className={inputCls} style={inputStyle}
                type="number" min={1} max={100}
                value={form.percentOff}
                onChange={e => setField("percentOff", Number(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider" style={dim}>Type</label>
              <select
                className={inputCls} style={inputStyle}
                value={form.type}
                onChange={e => setField("type", e.target.value as "GENERAL" | "PERSONALIZED")}
              >
                <option value="GENERAL">General (anyone)</option>
                <option value="PERSONALIZED">Personalized (specific email)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider" style={dim}>Applies to</label>
              <select
                className={inputCls} style={inputStyle}
                value={form.duration}
                onChange={e => setField("duration", e.target.value as "ONCE" | "FOREVER")}
              >
                <option value="ONCE">First payment only</option>
                <option value="FOREVER">Every payment (forever)</option>
              </select>
            </div>
          </div>

          {form.type === "PERSONALIZED" && (
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider" style={dim}>Recipient Email</label>
              <input
                className={inputCls} style={inputStyle}
                type="email" placeholder="user@example.com"
                value={form.email}
                onChange={e => setField("email", e.target.value)}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider" style={dim}>Expires At</label>
              <input
                className={inputCls} style={inputStyle}
                type="date"
                value={form.expiresAt}
                onChange={e => setField("expiresAt", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider" style={dim}>Max Redemptions (optional)</label>
              <input
                className={inputCls} style={inputStyle}
                type="number" min={1} placeholder="Unlimited"
                value={form.maxRedemptions}
                onChange={e => setField("maxRedemptions", e.target.value)}
              />
            </div>
          </div>

          {error && <p className="text-sm" style={{ color: "#ef4444" }}>{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              onClick={cancel}
              className="flex-1 rounded-lg border py-2 text-sm font-semibold hover:opacity-80"
              style={{ borderColor: "var(--sh-border2)", color: "var(--sh-muted)", background: "transparent" }}
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={loading}
              className="flex-1 rounded-lg py-2 text-sm font-bold text-white disabled:opacity-50"
              style={{ background: "var(--sh-primary-dark, #16a34a)" }}
            >
              {loading ? "Creating…" : "Create Coupon"}
            </button>
          </div>
        </div>
      )}

      {/* ── List ── */}
      {coupons.length === 0 ? (
        <div className="rounded-xl py-16 text-center" style={{ ...card, border: "1px solid var(--sh-border)" }}>
          <p className="text-3xl mb-3">🏷️</p>
          <p className="font-semibold" style={head}>No coupons yet</p>
          <p className="text-sm mt-1" style={dim}>Create one to offer discounts at subscription time</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--sh-border)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--sh-bg-card2)", borderBottom: "1px solid var(--sh-border)" }}>
                {["Code", "Type", "Discount", "Applies to", "Expires", "Used", "Status", ""].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={dim}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {coupons.map((c, i) => {
                const badge = statusBadge(c);
                return (
                  <tr
                    key={c.id}
                    style={{
                      background: i % 2 === 0 ? "var(--sh-bg-card)" : "var(--sh-bg-card2)",
                      borderBottom: "1px solid var(--sh-border)",
                    }}
                  >
                    <td className="px-4 py-3 font-mono font-bold" style={{ color: "var(--sh-primary)" }}>
                      {c.code}
                      {c.email && (
                        <span className="block text-xs font-sans font-normal mt-0.5" style={dim}>{c.email}</span>
                      )}
                    </td>
                    <td className="px-4 py-3" style={head}>{c.type === "GENERAL" ? "General" : "Personalized"}</td>
                    <td className="px-4 py-3 font-semibold" style={{ color: "var(--sh-primary)" }}>{c.percentOff}%</td>
                    <td className="px-4 py-3" style={dim}>{c.duration === "FOREVER" ? "Every payment" : "First only"}</td>
                    <td className="px-4 py-3" style={dim}>{new Date(c.expiresAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3" style={dim}>
                      {c.redemptionCount}
                      {c.maxRedemptions !== null ? ` / ${c.maxRedemptions}` : ""}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: badge.color, color: badge.text }}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => toggleActive(c)}
                          className="text-xs px-2 py-1 rounded border hover:opacity-80"
                          style={{ borderColor: "var(--sh-border2)", color: "var(--sh-muted)", background: "transparent" }}
                        >
                          {c.active ? "Deactivate" : "Activate"}
                        </button>
                        {deleteConfirm === c.id ? (
                          <>
                            <button
                              onClick={() => handleDelete(c.id)}
                              className="text-xs px-2 py-1 rounded font-semibold"
                              style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444" }}
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="text-xs px-2 py-1 rounded border hover:opacity-80"
                              style={{ borderColor: "var(--sh-border2)", color: "var(--sh-muted)", background: "transparent" }}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(c.id)}
                            disabled={c.leagueCount > 0}
                            className="text-xs px-2 py-1 rounded border hover:opacity-80 disabled:opacity-30"
                            style={{ borderColor: "rgba(239,68,68,0.3)", color: "#ef4444", background: "transparent" }}
                            title={c.leagueCount > 0 ? "Applied to leagues — cannot delete" : "Delete"}
                          >
                            Delete
                          </button>
                        )}
                      </div>
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
