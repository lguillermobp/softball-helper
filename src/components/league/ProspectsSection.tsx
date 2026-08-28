"use client";

import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Season { id: string; name: string; ageCutoffDate: string | null }
interface Cat { id: string; name: string; minAge: number | null; maxAge: number | null }
interface Prospect {
  id: string; name: string; dob: string | null; email: string | null; phone: string | null;
  parent1Name: string | null; parent1Email: string | null; parent1Phone: string | null;
  parent2Name: string | null; status: string; seasonId: string; categoryId: string;
  category: { name: string } | null;
}

function ageOn(dobISO: string, cutoffISO: string): number {
  const dob = new Date(dobISO), cutoff = new Date(cutoffISO);
  let age = cutoff.getFullYear() - dob.getFullYear();
  const m = cutoff.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && cutoff.getDate() < dob.getDate())) age--;
  return age;
}

const input = "w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500";
const inputStyle = { borderColor: "var(--sh-border)", background: "var(--sh-bg-card2)", color: "var(--sh-text)" };

function RegisterDialog({ slug, seasons, categories, defaultSeasonId, onDone }: {
  slug: string; seasons: Season[]; categories: Cat[]; defaultSeasonId: string; onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [seasonId, setSeasonId] = useState(defaultSeasonId);
  const [dob, setDob] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [touchedCat, setTouchedCat] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const season = seasons.find((s) => s.id === seasonId);
  const suggestedAge = dob && season?.ageCutoffDate ? ageOn(dob, season.ageCutoffDate) : null;

  // auto-suggest the category from age, until the user picks one manually
  useEffect(() => {
    if (touchedCat || suggestedAge == null) return;
    const fit = categories.filter((c) => c.minAge != null && c.maxAge != null && suggestedAge >= c.minAge && suggestedAge <= c.maxAge);
    if (fit.length === 1) setCategoryId(fit[0].id);
  }, [suggestedAge, touchedCat, categories]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true); setError("");
    const fd = new FormData(e.currentTarget);
    const body = Object.fromEntries(fd.entries());
    const res = await fetch(`/api/leagues/${slug}/prospects`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, seasonId, categoryId, dob }),
    });
    setSaving(false);
    if (!res.ok) { setError((await res.json()).error ?? "Failed to register"); return; }
    setOpen(false); setDob(""); setCategoryId(""); setTouchedCat(false);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setError(""); } }}>
      <DialogTrigger asChild><Button size="sm">+ Register prospect</Button></DialogTrigger>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Register a prospect</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="p-name">Full name *</Label>
            <Input id="p-name" name="name" required placeholder="Jane Smith" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="p-season">Season *</Label>
              <select id="p-season" className={input} style={inputStyle} value={seasonId} onChange={(e) => setSeasonId(e.target.value)} required>
                {seasons.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="p-dob">Date of birth</Label>
              <Input id="p-dob" name="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="p-cat">Category / division *</Label>
            <select id="p-cat" className={input} style={inputStyle} value={categoryId}
              onChange={(e) => { setCategoryId(e.target.value); setTouchedCat(true); }} required>
              <option value="">— Select category —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.minAge != null && c.maxAge != null ? ` (${c.minAge}–${c.maxAge})` : ""}
                </option>
              ))}
            </select>
            {suggestedAge != null && (
              <p className="text-xs" style={{ color: "var(--sh-muted)" }}>
                Age {suggestedAge} on the cutoff — {categoryId ? "category suggested automatically; change it if needed." : "no single category matches; pick one."}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label htmlFor="p-email">Player email</Label><Input id="p-email" name="email" type="email" placeholder="optional" /></div>
            <div className="space-y-1"><Label htmlFor="p-phone">Player phone</Label><Input id="p-phone" name="phone" placeholder="optional" /></div>
          </div>

          <fieldset className="rounded-xl border p-3 space-y-3" style={{ borderColor: "var(--sh-border)" }}>
            <legend className="text-xs font-semibold px-1" style={{ color: "var(--sh-primary)" }}>Parent / guardian 1 *</legend>
            <Input name="parent1Name" required placeholder="Name *" />
            <div className="grid grid-cols-2 gap-3">
              <Input name="parent1Email" type="email" placeholder="Email" />
              <Input name="parent1Phone" placeholder="Phone" />
            </div>
          </fieldset>
          <fieldset className="rounded-xl border p-3 space-y-3" style={{ borderColor: "var(--sh-border)" }}>
            <legend className="text-xs font-semibold px-1" style={{ color: "var(--sh-muted)" }}>Parent / guardian 2 (optional)</legend>
            <Input name="parent2Name" placeholder="Name" />
            <div className="grid grid-cols-2 gap-3">
              <Input name="parent2Email" type="email" placeholder="Email" />
              <Input name="parent2Phone" placeholder="Phone" />
            </div>
          </fieldset>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Register"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ProspectsSection({ slug, seasons, categories, canManage, isSuspended }: {
  slug: string; seasons: Season[]; categories: Cat[]; canManage: boolean; isSuspended: boolean;
}) {
  const [seasonId, setSeasonId] = useState(seasons[0]?.id ?? "");
  const [catFilter, setCatFilter] = useState("");
  const [list, setList] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!seasonId) { setList([]); return; }
    setLoading(true);
    const qs = new URLSearchParams({ seasonId, ...(catFilter ? { categoryId: catFilter } : {}) });
    const res = await fetch(`/api/leagues/${slug}/prospects?${qs.toString()}`);
    const d = await res.json().catch(() => ({ prospects: [] }));
    setList(res.ok ? d.prospects : []);
    setLoading(false);
  }, [slug, seasonId, catFilter]);
  useEffect(() => { void load(); }, [load]);

  const season = seasons.find((s) => s.id === seasonId);

  async function remove(id: string) {
    if (!confirm("Remove this prospect?")) return;
    const res = await fetch(`/api/leagues/${slug}/prospects/${id}`, { method: "DELETE" });
    if (res.ok) void load();
  }

  const canRegister = canManage && !isSuspended && seasons.length > 0 && categories.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-bold" style={{ color: "var(--sh-text)" }}>Prospects</h2>
        {canRegister && <RegisterDialog slug={slug} seasons={seasons} categories={categories} defaultSeasonId={seasonId} onDone={load} />}
      </div>

      {seasons.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--sh-muted)" }}>Create a season first to register prospects.</p>
      ) : categories.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--sh-muted)" }}>Add at least one category (with an age range) first.</p>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <select className="rounded-md border px-3 py-1.5 text-sm" style={inputStyle} value={seasonId} onChange={(e) => setSeasonId(e.target.value)}>
              {seasons.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select className="rounded-md border px-3 py-1.5 text-sm" style={inputStyle} value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
              <option value="">All categories</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <span className="text-xs" style={{ color: "var(--sh-muted)" }}>{loading ? "Loading…" : `${list.length} prospect${list.length !== 1 ? "s" : ""}`}</span>
          </div>

          {list.length === 0 && !loading ? (
            <div className="rounded-2xl border py-10 text-center text-sm" style={{ borderColor: "var(--sh-border)", color: "var(--sh-muted)" }}>
              No prospects registered yet.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--sh-border)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--sh-border)", color: "var(--sh-muted)" }}>
                    <th className="text-left px-3 py-2 font-semibold">Name</th>
                    <th className="text-left px-3 py-2 font-semibold">Age</th>
                    <th className="text-left px-3 py-2 font-semibold">Category</th>
                    <th className="text-left px-3 py-2 font-semibold">Parent 1</th>
                    <th className="text-left px-3 py-2 font-semibold">Status</th>
                    {canManage && <th className="px-3 py-2" />}
                  </tr>
                </thead>
                <tbody>
                  {list.map((p) => (
                    <tr key={p.id} style={{ borderBottom: "1px solid var(--sh-border)" }}>
                      <td className="px-3 py-2 font-medium" style={{ color: "var(--sh-text)" }}>{p.name}</td>
                      <td className="px-3 py-2" style={{ color: "var(--sh-secondary)" }}>
                        {p.dob && season?.ageCutoffDate ? ageOn(p.dob, season.ageCutoffDate) : "—"}
                      </td>
                      <td className="px-3 py-2" style={{ color: "var(--sh-secondary)" }}>{p.category?.name ?? "—"}</td>
                      <td className="px-3 py-2" style={{ color: "var(--sh-secondary)" }}>
                        {p.parent1Name ?? "—"}
                        {p.parent1Email && <span className="block text-xs" style={{ color: "var(--sh-muted)" }}>{p.parent1Email}</span>}
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{
                          background: p.status === "DRAFTED" ? "rgba(74,222,128,.14)" : "var(--sh-bg-card2)",
                          color: p.status === "DRAFTED" ? "#4ade80" : "var(--sh-muted)",
                        }}>{p.status === "DRAFTED" ? "Drafted" : "Registered"}</span>
                      </td>
                      {canManage && (
                        <td className="px-3 py-2 text-right">
                          <button onClick={() => remove(p.id)} className="text-xs px-2 py-1 rounded-md border"
                            style={{ borderColor: "#7f1d1d", color: "#f87171", background: "transparent" }}>Remove</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
