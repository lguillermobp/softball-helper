"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Cat { id: string; name: string; description: string | null; minAge: number | null; maxAge: number | null }

export function CategoryAgeRow({ cat, slug, canEdit }: { cat: Cat; slug: string; canEdit: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [min, setMin] = useState(cat.minAge?.toString() ?? "");
  const [max, setMax] = useState(cat.maxAge?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [showAdmins, setShowAdmins] = useState(false);
  const [admins, setAdmins] = useState<{ id: string; name: string | null; email: string }[] | null>(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminErr, setAdminErr] = useState("");

  const hasAges = cat.minAge != null && cat.maxAge != null;

  async function loadAdmins() {
    const res = await fetch(`/api/leagues/${slug}/categories/${cat.id}/admins`);
    if (res.ok) setAdmins((await res.json()).admins);
  }
  async function toggleAdmins() {
    const next = !showAdmins;
    setShowAdmins(next);
    if (next && admins === null) await loadAdmins();
  }
  async function addAdmin() {
    if (!adminEmail.trim()) return;
    setAdminBusy(true); setAdminErr("");
    const res = await fetch(`/api/leagues/${slug}/categories/${cat.id}/admins`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: adminEmail.trim() }),
    });
    setAdminBusy(false);
    if (!res.ok) { setAdminErr((await res.json()).error ?? "Failed to add"); return; }
    setAdminEmail(""); await loadAdmins();
  }
  async function removeAdmin(userId: string) {
    await fetch(`/api/leagues/${slug}/categories/${cat.id}/admins?userId=${encodeURIComponent(userId)}`, { method: "DELETE" });
    await loadAdmins();
  }

  async function save() {
    setSaving(true); setError("");
    const res = await fetch(`/api/leagues/${slug}/categories/${cat.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ minAge: min, maxAge: max }),
    });
    setSaving(false);
    if (!res.ok) { setError((await res.json()).error ?? "Failed to save"); return; }
    setEditing(false);
    router.refresh();
  }

  return (
    <div className="rounded-xl border px-4 py-3" style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" }}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="font-semibold" style={{ color: "var(--sh-text)" }}>{cat.name}</span>
          {cat.description && <span className="text-sm" style={{ color: "var(--sh-muted)" }}> — {cat.description}</span>}
        </div>
        {!editing && (
          <div className="flex items-center gap-2 shrink-0">
            {hasAges ? (
              <span className="text-xs font-semibold px-2 py-1 rounded-md" style={{ background: "var(--sh-bg-card2)", color: "var(--sh-primary)", border: "1px solid var(--sh-border2)" }}>
                ages {cat.minAge}–{cat.maxAge}
              </span>
            ) : (
              <span className="text-xs font-semibold px-2 py-1 rounded-md" style={{ background: "rgba(245,158,11,.14)", color: "#f59e0b" }}>
                no age range
              </span>
            )}
            {canEdit && (
              <button onClick={() => setEditing(true)} className="text-xs px-2 py-1 rounded-md border"
                style={{ borderColor: "var(--sh-border2)", color: "var(--sh-primary)", background: "transparent" }}>
                {hasAges ? "Edit" : "Set ages"}
              </button>
            )}
            {canEdit && (
              <button onClick={toggleAdmins} className="text-xs px-2 py-1 rounded-md border"
                style={{ borderColor: "var(--sh-border2)", color: "var(--sh-secondary)", background: "transparent" }}>
                Admins{admins ? ` (${admins.length})` : ""}
              </button>
            )}
          </div>
        )}
      </div>

      {editing && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--sh-muted)" }}>Min age</label>
            <input type="number" min="0" value={min} onChange={(e) => setMin(e.target.value)}
              className="w-24 rounded-md border px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-green-500"
              style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card2)", color: "var(--sh-text)" }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--sh-muted)" }}>Max age</label>
            <input type="number" min="0" value={max} onChange={(e) => setMax(e.target.value)}
              className="w-24 rounded-md border px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-green-500"
              style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card2)", color: "var(--sh-text)" }} />
          </div>
          <button onClick={save} disabled={saving} className="text-xs px-3 py-1.5 rounded-md font-semibold disabled:opacity-50"
            style={{ background: "var(--sh-primary)", color: "#04120a" }}>{saving ? "Saving…" : "Save"}</button>
          <button onClick={() => { setEditing(false); setError(""); }} className="text-xs px-2 py-1.5 rounded-md border"
            style={{ borderColor: "var(--sh-border2)", color: "var(--sh-secondary)", background: "transparent" }}>Cancel</button>
          {error && <span className="text-xs w-full" style={{ color: "#f87171" }}>{error}</span>}
        </div>
      )}

      {showAdmins && (
        <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--sh-border)" }}>
          <p className="text-xs font-semibold mb-2" style={{ color: "var(--sh-muted)" }}>Category admins — run this division&apos;s tryouts &amp; draft</p>
          {admins === null ? (
            <p className="text-xs" style={{ color: "var(--sh-muted)" }}>Loading…</p>
          ) : admins.length === 0 ? (
            <p className="text-xs mb-2" style={{ color: "var(--sh-muted)" }}>No admins yet.</p>
          ) : (
            <ul className="space-y-1 mb-2">
              {admins.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
                  <span style={{ color: "var(--sh-text)" }}>{a.name ?? a.email} <span style={{ color: "var(--sh-muted)" }}>· {a.email}</span></span>
                  <button onClick={() => removeAdmin(a.id)} className="text-xs px-2 py-0.5 rounded-md border"
                    style={{ borderColor: "#7f1d1d", color: "#f87171", background: "transparent" }}>Remove</button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center gap-2">
            <input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="admin@email.com"
              className="flex-1 rounded-md border px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-green-500"
              style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card2)", color: "var(--sh-text)" }} />
            <button onClick={addAdmin} disabled={adminBusy} className="text-xs px-3 py-1.5 rounded-md font-semibold disabled:opacity-50"
              style={{ background: "var(--sh-primary)", color: "#04120a" }}>{adminBusy ? "Adding…" : "Add admin"}</button>
          </div>
          {adminErr && <p className="text-xs mt-1" style={{ color: "#f87171" }}>{adminErr}</p>}
        </div>
      )}
    </div>
  );
}
