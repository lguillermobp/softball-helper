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

  const hasAges = cat.minAge != null && cat.maxAge != null;

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
    </div>
  );
}
