"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Season { id: string; name: string }
interface Cat { id: string; name: string }
interface Field { id: string; name: string }
interface TryoutRow {
  id: string; name: string | null; scheduledAt: string | null; status: string;
  category: { name: string } | null; field: { name: string } | null;
  _count: { participants: number; evaluators: number; skills: number };
}

const input = "w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500";
const inputStyle = { borderColor: "var(--sh-border)", background: "var(--sh-bg-card2)", color: "var(--sh-text)" };
const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  SETUP: { label: "Setup", color: "var(--sh-muted)", bg: "var(--sh-bg-card2)" },
  LIVE:  { label: "Live",  color: "#4ade80", bg: "rgba(74,222,128,.14)" },
  DONE:  { label: "Done",  color: "#60a5fa", bg: "rgba(96,165,250,.14)" },
};

function CreateTryoutDialog({ slug, seasons, categories, fields, defaultSeasonId, onDone }: {
  slug: string; seasons: Season[]; categories: Cat[]; fields: Field[]; defaultSeasonId: string; onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [seasonId, setSeasonId] = useState(defaultSeasonId);
  const [categoryId, setCategoryId] = useState("");
  const [skills, setSkills] = useState<string[]>(["Batting", "Fielding", "Running"]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function setSkill(i: number, v: string) { setSkills((s) => s.map((x, j) => (j === i ? v : x))); }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true); setError("");
    const fd = new FormData(e.currentTarget);
    const res = await fetch(`/api/leagues/${slug}/tryouts`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        seasonId, categoryId,
        name: fd.get("name"),
        scheduledAt: fd.get("scheduledAt") || null,
        fieldId: fd.get("fieldId") || null,
        ratingMin: fd.get("ratingMin"), ratingMax: fd.get("ratingMax"),
        skills: skills.map((s) => s.trim()).filter(Boolean),
      }),
    });
    setSaving(false);
    if (!res.ok) { setError((await res.json()).error ?? "Failed to create"); return; }
    setOpen(false); onDone();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setError(""); }}>
      <DialogTrigger asChild><Button size="sm">+ New tryout</Button></DialogTrigger>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New tryout</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="t-name">Name</Label>
            <Input id="t-name" name="name" placeholder="e.g. Junior — Session 1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="t-season">Season *</Label>
              <select id="t-season" className={input} style={inputStyle} value={seasonId} onChange={(e) => setSeasonId(e.target.value)} required>
                {seasons.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="t-cat">Category *</Label>
              <select id="t-cat" className={input} style={inputStyle} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
                <option value="">— Select —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="t-when">Date &amp; time</Label>
              <Input id="t-when" name="scheduledAt" type="datetime-local" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="t-field">Field</Label>
              <select id="t-field" name="fieldId" className={input} style={inputStyle} defaultValue="">
                <option value="">— No field —</option>
                {fields.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label htmlFor="t-min">Rating from</Label><Input id="t-min" name="ratingMin" type="number" min="0" defaultValue={1} /></div>
            <div className="space-y-1"><Label htmlFor="t-max">Rating to</Label><Input id="t-max" name="ratingMax" type="number" min="1" defaultValue={5} /></div>
          </div>
          <div className="space-y-2">
            <Label>Skills to assess *</Label>
            {skills.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input value={s} onChange={(e) => setSkill(i, e.target.value)} placeholder="e.g. Batting" />
                {skills.length > 1 && (
                  <button type="button" onClick={() => setSkills((arr) => arr.filter((_, j) => j !== i))}
                    className="text-xs px-2 py-1 rounded-md border" style={{ borderColor: "#7f1d1d", color: "#f87171", background: "transparent" }}>✕</button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => setSkills((s) => [...s, ""])} className="text-sm underline" style={{ color: "var(--sh-primary)" }}>+ Add skill</button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Create"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TryoutsSection({ slug, seasons, categories, fields, canManage, isSuspended }: {
  slug: string; seasons: Season[]; categories: Cat[]; fields: Field[]; canManage: boolean; isSuspended: boolean;
}) {
  const [seasonId, setSeasonId] = useState(seasons[0]?.id ?? "");
  const [list, setList] = useState<TryoutRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!seasonId) { setList([]); return; }
    setLoading(true);
    const res = await fetch(`/api/leagues/${slug}/tryouts?seasonId=${seasonId}`);
    const d = await res.json().catch(() => ({ tryouts: [] }));
    setList(res.ok ? d.tryouts : []);
    setLoading(false);
  }, [slug, seasonId]);
  useEffect(() => { void load(); }, [load]);

  const canCreate = canManage && !isSuspended && seasons.length > 0 && categories.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-bold" style={{ color: "var(--sh-text)" }}>Tryouts</h2>
        {canCreate && <CreateTryoutDialog slug={slug} seasons={seasons} categories={categories} fields={fields} defaultSeasonId={seasonId} onDone={load} />}
      </div>

      {seasons.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--sh-muted)" }}>Create a season and a category first.</p>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <select className="rounded-md border px-3 py-1.5 text-sm" style={inputStyle} value={seasonId} onChange={(e) => setSeasonId(e.target.value)}>
              {seasons.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <span className="text-xs" style={{ color: "var(--sh-muted)" }}>{loading ? "Loading…" : `${list.length} tryout${list.length !== 1 ? "s" : ""}`}</span>
          </div>

          {list.length === 0 && !loading ? (
            <div className="rounded-2xl border py-10 text-center text-sm" style={{ borderColor: "var(--sh-border)", color: "var(--sh-muted)" }}>
              No tryouts yet.
            </div>
          ) : (
            <div className="grid gap-2">
              {list.map((t) => {
                const st = STATUS[t.status] ?? STATUS.SETUP;
                return (
                  <Link key={t.id} href={`/league/${slug}/tryout/${t.id}`}
                    className="rounded-xl border px-4 py-3 flex items-center justify-between gap-3 transition-colors hover:opacity-90"
                    style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" }}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold" style={{ color: "var(--sh-text)" }}>{t.name || `${t.category?.name ?? "Tryout"}`}</span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: "var(--sh-muted)" }}>
                        {t.category?.name}{t.scheduledAt ? ` · ${new Date(t.scheduledAt).toLocaleString()}` : ""}{t.field?.name ? ` · ${t.field.name}` : ""}
                        {" · "}{t._count.participants} players · {t._count.evaluators} coaches · {t._count.skills} skills
                      </div>
                    </div>
                    <span style={{ color: "var(--sh-primary)" }}>›</span>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
