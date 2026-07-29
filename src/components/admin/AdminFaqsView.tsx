"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Faq {
  id: string;
  category: string;
  questionEn: string;
  questionEs: string;
  answerEn: string;
  answerEs: string;
  order: number;
  active: boolean;
}

type Draft = Omit<Faq, "id">;

const card = { borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" };
const inputStyle = { background: "var(--sh-bg-card2)", borderColor: "var(--sh-border)", color: "var(--sh-text)" };
const inputCls = "w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500";

const EMPTY: Draft = { category: "General", questionEn: "", questionEs: "", answerEn: "", answerEs: "", order: 0, active: true };

function FaqForm({ initial, onSave, onCancel, saving }: {
  initial: Draft; onSave: (d: Draft) => void; onCancel: () => void; saving: boolean;
}) {
  const [d, setD] = useState<Draft>(initial);
  const set = (k: keyof Draft, v: unknown) => setD((p) => ({ ...p, [k]: v }));
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-xs" style={{ color: "var(--sh-muted)" }}>Category</label>
          <input className={inputCls} style={inputStyle} value={d.category} onChange={(e) => set("category", e.target.value)} placeholder="e.g. Roster & Players" />
        </div>
        <div>
          <label className="text-xs" style={{ color: "var(--sh-muted)" }}>Order</label>
          <input type="number" className={inputCls} style={inputStyle} value={d.order} onChange={(e) => set("order", parseInt(e.target.value) || 0)} />
        </div>
        <label className="flex items-end gap-2 pb-2 cursor-pointer select-none">
          <input type="checkbox" checked={d.active} onChange={(e) => set("active", e.target.checked)} className="w-4 h-4 rounded accent-green-500" />
          <span className="text-sm" style={{ color: "var(--sh-secondary)" }}>Active (shown on Help)</span>
        </label>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs" style={{ color: "var(--sh-muted)" }}>Question (English)</label>
          <input className={inputCls} style={inputStyle} value={d.questionEn} onChange={(e) => set("questionEn", e.target.value)} />
        </div>
        <div>
          <label className="text-xs" style={{ color: "var(--sh-muted)" }}>Question (Español)</label>
          <input className={inputCls} style={inputStyle} value={d.questionEs} onChange={(e) => set("questionEs", e.target.value)} />
        </div>
        <div>
          <label className="text-xs" style={{ color: "var(--sh-muted)" }}>Answer (English)</label>
          <textarea className={inputCls} style={inputStyle} rows={3} value={d.answerEn} onChange={(e) => set("answerEn", e.target.value)} />
        </div>
        <div>
          <label className="text-xs" style={{ color: "var(--sh-muted)" }}>Answer (Español)</label>
          <textarea className={inputCls} style={inputStyle} rows={3} value={d.answerEs} onChange={(e) => set("answerEs", e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="text-sm px-3 py-1.5 rounded-md border"
          style={{ borderColor: "var(--sh-border2)", color: "var(--sh-secondary)", background: "transparent" }}>Cancel</button>
        <button onClick={() => onSave(d)} disabled={saving}
          className="text-sm px-4 py-1.5 rounded-md font-semibold disabled:opacity-50"
          style={{ background: "var(--sh-primary)", color: "#04120a" }}>{saving ? "Saving…" : "Save"}</button>
      </div>
    </div>
  );
}

export function AdminFaqsView({ initialFaqs }: { initialFaqs: Faq[] }) {
  const router = useRouter();
  const [faqs] = useState<Faq[]>(initialFaqs);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function createFaq(d: Draft) {
    setSaving(true); setError("");
    const res = await fetch("/api/admin/faqs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) });
    setSaving(false);
    if (!res.ok) { setError((await res.json()).error ?? "Failed to create"); return; }
    setAdding(false); router.refresh();
  }
  async function updateFaq(id: string, d: Draft) {
    setSaving(true); setError("");
    const res = await fetch(`/api/admin/faqs/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) });
    setSaving(false);
    if (!res.ok) { setError((await res.json()).error ?? "Failed to update"); return; }
    setEditingId(null); router.refresh();
  }
  async function deleteFaq(id: string) {
    if (!confirm("Delete this FAQ?")) return;
    const res = await fetch(`/api/admin/faqs/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh(); else setError("Failed to delete");
  }

  const categories = [...new Set(faqs.map((f) => f.category))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black" style={{ color: "var(--sh-text)" }}>Manage FAQs</h1>
          <p className="text-sm" style={{ color: "var(--sh-muted)" }}>{faqs.length} question{faqs.length !== 1 ? "s" : ""} · shown on the Help page in English &amp; Spanish.</p>
        </div>
        {!adding && (
          <button onClick={() => { setAdding(true); setEditingId(null); }}
            className="text-sm px-4 py-2 rounded-md font-semibold" style={{ background: "var(--sh-primary)", color: "#04120a" }}>+ New FAQ</button>
        )}
      </div>

      {error && <p className="text-sm" style={{ color: "#f87171" }}>{error}</p>}

      {adding && (
        <div className="rounded-xl border p-4" style={card}>
          <FaqForm initial={EMPTY} onSave={createFaq} onCancel={() => setAdding(false)} saving={saving} />
        </div>
      )}

      {categories.map((cat) => (
        <div key={cat} className="space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: "var(--sh-primary)" }}>{cat}</h2>
          {faqs.filter((f) => f.category === cat).map((f) => (
            <div key={f.id} className="rounded-xl border p-4" style={card}>
              {editingId === f.id ? (
                <FaqForm initial={f} onSave={(d) => updateFaq(f.id, d)} onCancel={() => setEditingId(null)} saving={saving} />
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ color: "var(--sh-muted)", border: "1px solid var(--sh-border2)" }}>#{f.order}</span>
                      {!f.active && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444" }}>Hidden</span>}
                    </div>
                    <p className="font-semibold" style={{ color: "var(--sh-text)" }}>{f.questionEn}</p>
                    <p className="text-sm" style={{ color: "var(--sh-muted)" }}>{f.questionEs}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => { setEditingId(f.id); setAdding(false); }} className="text-xs px-2 py-1 rounded-md border"
                      style={{ borderColor: "var(--sh-border2)", color: "var(--sh-primary)", background: "transparent" }}>Edit</button>
                    <button onClick={() => deleteFaq(f.id)} className="text-xs px-2 py-1 rounded-md border"
                      style={{ borderColor: "#7f1d1d", color: "#f87171", background: "transparent" }}>Delete</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
