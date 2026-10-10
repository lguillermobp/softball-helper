"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TeamRef { id: string; name: string; league: { name: string; slug: string } }
interface Club { id: string; name: string; slug: string; subdomain: string | null; createdAt: string; teams: TeamRef[] }

function SubdomainField({ clubId, slug, current, onDone }: { clubId: string; slug: string; current: string | null; onDone: () => void }) {
  const [val, setVal] = useState(current ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  async function save() {
    setSaving(true); setMsg("");
    const res = await fetch(`/api/clubs/${clubId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subdomain: val }) });
    setSaving(false);
    if (!res.ok) { setMsg((await res.json().catch(() => ({}))).error ?? "Failed"); return; }
    onDone();
  }
  const publicHref = current ? `https://${current}.dugoutadmin.com` : `/club/${slug}`;
  return (
    <div className="flex items-center gap-2 flex-wrap text-sm rounded-lg px-3 py-2" style={{ background: "var(--sh-bg-card2)" }}>
      <span style={{ color: "var(--sh-muted)" }}>Site:</span>
      <input value={val} onChange={(e) => setVal(e.target.value)} placeholder="your-club"
        className="rounded-md border px-2 py-1 text-sm w-36" style={inputStyle} />
      <span className="text-xs" style={{ color: "var(--sh-muted)" }}>.dugoutadmin.com</span>
      <button onClick={save} disabled={saving} className="text-xs px-2 py-1 rounded-md border" style={{ borderColor: "var(--sh-border2)", color: "var(--sh-primary)", background: "transparent" }}>
        {saving ? "…" : "Save"}
      </button>
      <a href={publicHref} target="_blank" rel="noreferrer" className="text-xs font-semibold" style={{ color: "var(--sh-primary)" }}>View public page →</a>
      {msg && <span className="text-xs" style={{ color: "#f87171" }}>{msg}</span>}
    </div>
  );
}

const card = { borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" } as const;
const inputStyle = { borderColor: "var(--sh-border)", background: "var(--sh-bg-card2)", color: "var(--sh-text)" } as const;
const sel = "rounded-md border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-green-500";

function CreateClubDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError("");
    const res = await fetch("/api/clubs", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setSaving(false);
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? "Failed to create club"); return; }
    setOpen(false); setName(""); onDone();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setError(""); }}>
      <DialogTrigger asChild><Button size="sm">+ New club</Button></DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Create a club</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="club-name">Club name *</Label>
            <Input id="club-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Winter Park Wildcats" required />
          </div>
          {error && <p className="text-sm" style={{ color: "#f87171" }}>{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Creating…" : "Create"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ClubsView() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [attachable, setAttachable] = useState<TeamRef[]>([]);
  const [canCreate, setCanCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [pick, setPick] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/clubs");
    const d = await res.json().catch(() => ({ clubs: [], attachableTeams: [] }));
    if (res.ok) { setClubs(d.clubs); setAttachable(d.attachableTeams); setCanCreate(d.canCreate); }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function call(url: string, method: string, body?: unknown) {
    setErr("");
    const res = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : {}, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!res.ok) { setErr((await res.json().catch(() => ({}))).error ?? "Something went wrong"); return false; }
    await load();
    return true;
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--sh-bg)" }}>
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <Link href="/dashboard" className="text-sm" style={{ color: "var(--sh-primary)" }}>← Dashboard</Link>
            <h1 className="text-2xl font-black mt-1" style={{ color: "var(--sh-text)" }}>My Clubs</h1>
            <p className="text-sm" style={{ color: "var(--sh-muted)" }}>
              A club groups your teams across leagues. Attaching a team here doesn&apos;t change its league roster or standings.
            </p>
          </div>
          {canCreate && <CreateClubDialog onDone={load} />}
        </div>

        {err && <p className="text-sm" style={{ color: "#f87171" }}>{err}</p>}

        {loading ? (
          <p className="text-sm" style={{ color: "var(--sh-muted)" }}>Loading…</p>
        ) : clubs.length === 0 ? (
          <div className="rounded-2xl border py-12 text-center" style={{ borderColor: "var(--sh-border)" }}>
            <p className="text-sm" style={{ color: "var(--sh-muted)" }}>
              {canCreate ? "No clubs yet. Create one to group your teams." : "You need to manage a team before you can create a club."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {clubs.map((c) => (
              <section key={c.id} className="rounded-xl border p-4 space-y-3" style={card}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <h2 className="font-bold" style={{ color: "var(--sh-text)" }}>{c.name}</h2>
                    <p className="text-xs font-mono" style={{ color: "var(--sh-muted)" }}>{c.slug}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs" style={{ color: "var(--sh-muted)" }}>{c.teams.length} team{c.teams.length !== 1 ? "s" : ""}</span>
                    <Link href={`/clubs/${c.id}`} className="text-xs font-semibold" style={{ color: "var(--sh-primary)" }}>Master roster →</Link>
                  </div>
                </div>

                <SubdomainField clubId={c.id} slug={c.slug} current={c.subdomain} onDone={load} />

                <ul className="space-y-1">
                  {c.teams.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-2 text-sm rounded-lg px-3 py-2" style={{ background: "var(--sh-bg-card2)" }}>
                      <span style={{ color: "var(--sh-text)" }}>
                        {t.name} <span style={{ color: "var(--sh-muted)" }}>· {t.league.name}</span>
                      </span>
                      <button onClick={() => { if (confirm(`Remove ${t.name} from ${c.name}?`)) void call(`/api/clubs/${c.id}/teams?teamId=${t.id}`, "DELETE"); }}
                        className="text-xs px-2 py-1 rounded-md border" style={{ borderColor: "#7f1d1d", color: "#f87171", background: "transparent" }}>
                        Detach
                      </button>
                    </li>
                  ))}
                  {c.teams.length === 0 && <li className="text-sm" style={{ color: "var(--sh-muted)" }}>No teams attached yet.</li>}
                </ul>

                {attachable.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <select className={sel} style={inputStyle} value={pick[c.id] ?? ""} onChange={(e) => setPick((p) => ({ ...p, [c.id]: e.target.value }))}>
                      <option value="">— Attach a team you manage —</option>
                      {attachable.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.league.name})</option>)}
                    </select>
                    <button
                      onClick={async () => { const id = pick[c.id]; if (id && await call(`/api/clubs/${c.id}/teams`, "POST", { teamId: id })) setPick((p) => ({ ...p, [c.id]: "" })); }}
                      disabled={!pick[c.id]}
                      className="text-sm px-3 py-1.5 rounded-md font-semibold disabled:opacity-50"
                      style={{ background: "var(--sh-primary)", color: "#04120a" }}>
                      Attach
                    </button>
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
