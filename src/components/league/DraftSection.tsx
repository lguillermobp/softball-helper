"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Season { id: string; name: string }
interface Cat { id: string; name: string }

const input = "rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500";
const inputStyle = { borderColor: "var(--sh-border)", background: "var(--sh-bg-card2)", color: "var(--sh-text)" };

export function DraftSection({ slug, seasons, categories, canManage }: {
  slug: string; seasons: Season[]; categories: Cat[]; canManage: boolean;
}) {
  const router = useRouter();
  const [seasonId, setSeasonId] = useState(seasons[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function open() {
    if (!seasonId || !categoryId) { setErr("Pick a season and category."); return; }
    setBusy(true); setErr("");
    const res = await fetch(`/api/leagues/${slug}/drafts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ seasonId, categoryId }) });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) { setErr(d.error ?? "Failed to open the draft"); return; }
    router.push(`/league/${slug}/draft/${d.id}`);
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold" style={{ color: "var(--sh-text)" }}>Draft</h2>
      {seasons.length === 0 || categories.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--sh-muted)" }}>Create a season and a category first.</p>
      ) : !canManage ? (
        <p className="text-sm" style={{ color: "var(--sh-muted)" }}>Only league or category admins run the draft.</p>
      ) : (
        <div className="rounded-xl border p-4" style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" }}>
          <p className="text-sm mb-3" style={{ color: "var(--sh-muted)" }}>Open the draft board for a division to draw lots, set keepers, and run the draft.</p>
          <div className="flex flex-wrap items-center gap-2">
            <select className={input} style={inputStyle} value={seasonId} onChange={(e) => setSeasonId(e.target.value)}>
              {seasons.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select className={input} style={inputStyle} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">— Category —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button onClick={open} disabled={busy} className="text-sm px-4 py-2 rounded-md font-semibold disabled:opacity-50" style={{ background: "var(--sh-primary)", color: "#04120a" }}>
              {busy ? "Opening…" : "Open draft board →"}
            </button>
          </div>
          {err && <p className="text-sm mt-2" style={{ color: "#f87171" }}>{err}</p>}
        </div>
      )}
    </div>
  );
}
