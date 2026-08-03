"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Season { id: string; name: string }
interface Category { id: string; name: string }
interface StaffMember { id: string; name: string | null; email: string; phone: string | null }

interface Props {
  slug: string;
  team: {
    id: string;
    name: string;
    seasons: { seasonId: string; categoryId: string | null }[];
    manager: StaffMember | null;
    assistant: StaffMember | null;
  };
  managerRole?: string;
  assistantRole?: string;
  seasons: Season[];
  categories: Category[];
}

const selectClass =
  "w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500";

function StaffFields({
  prefix,
  label,
  required,
  defaultValues,
}: {
  prefix: string;
  label: string;
  required?: boolean;
  defaultValues?: { name?: string | null; email?: string; phone?: string | null };
}) {
  return (
    <div className="space-y-3 rounded-xl p-3" style={{ background: "var(--sh-bg-card2)", border: "1px solid var(--sh-border)" }}>
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--sh-primary)" }}>
        {label}{required && " *"}
      </p>
      <div className="space-y-1">
        <Label htmlFor={`${prefix}-name`}>Full name {required && "*"}</Label>
        <Input
          id={`${prefix}-name`}
          name={`${prefix}-name`}
          placeholder="Jane Smith"
          defaultValue={defaultValues?.name ?? ""}
          required={required}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${prefix}-email`}>Email address {required && "*"}</Label>
        <Input
          id={`${prefix}-email`}
          name={`${prefix}-email`}
          type="email"
          placeholder="jane@example.com"
          defaultValue={defaultValues?.email ?? ""}
          required={required}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${prefix}-phone`}>Mobile phone (optional)</Label>
        <Input
          id={`${prefix}-phone`}
          name={`${prefix}-phone`}
          type="tel"
          placeholder="+1 555 000 0000"
          defaultValue={defaultValues?.phone ?? ""}
        />
      </div>
    </div>
  );
}

export function EditTeamDialog({ slug, team, managerRole, assistantRole, seasons, categories }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasAssistant, setHasAssistant] = useState(!!team.assistant);
  const [managerPlays, setManagerPlays] = useState(managerRole === "TEAM_MANAGER_PLAYER");
  const [assistantPlays, setAssistantPlays] = useState(assistantRole === "TEAM_ASSISTANT_PLAYER");
  const initialRegs = team.seasons.length
    ? team.seasons.map((s) => ({ seasonId: s.seasonId, categoryId: s.categoryId ?? "" }))
    : (seasons.length ? [{ seasonId: "", categoryId: "" }] : []);
  const [regs, setRegs] = useState<Array<{ seasonId: string; categoryId: string }>>(initialRegs);

  function setReg(i: number, patch: Partial<{ seasonId: string; categoryId: string }>) {
    setRegs((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addReg() { setRegs((rs) => [...rs, { seasonId: "", categoryId: "" }]); }
  function removeReg(i: number) { setRegs((rs) => rs.filter((_, idx) => idx !== i)); }

  function handleClose() { setOpen(false); setError(""); setRegs(initialRegs); }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);

    const body: Record<string, unknown> = {
      name: fd.get("name"),
      seasons: regs
        .filter((r) => r.seasonId)
        .map((r) => ({ seasonId: r.seasonId, categoryId: r.categoryId || null })),
      manager: {
        name: fd.get("manager-name"),
        email: fd.get("manager-email"),
        phone: fd.get("manager-phone") || undefined,
      },
      managerRole: managerPlays ? "TEAM_MANAGER_PLAYER" : "TEAM_MANAGER",
    };

    if (hasAssistant) {
      body.assistant = {
        name: fd.get("assistant-name"),
        email: fd.get("assistant-email"),
        phone: fd.get("assistant-phone") || undefined,
      };
      body.assistantRole = assistantPlays ? "TEAM_ASSISTANT_PLAYER" : "TEAM_ASSISTANT";
    }

    const res = await fetch(`/api/leagues/${slug}/teams/${team.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Something went wrong");
      return;
    }
    handleClose();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true); }}>
      <DialogTrigger asChild>
        <button
          className="text-xs px-2 py-1 rounded-md border transition-colors hover:opacity-80"
          style={{ borderColor: "var(--sh-border2)", color: "var(--sh-primary)", background: "transparent" }}
        >
          Edit
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Team</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="name">Team name *</Label>
            <Input id="name" name="name" defaultValue={team.name} required />
          </div>

          {seasons.length > 0 && (
            <div className="space-y-2">
              <Label>Seasons &amp; divisions</Label>
              {regs.map((r, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <select value={r.seasonId} onChange={(e) => setReg(i, { seasonId: e.target.value })} className={selectClass}>
                    <option value="">— Select season —</option>
                    {seasons.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  {categories.length > 0 && (
                    <select value={r.categoryId} onChange={(e) => setReg(i, { categoryId: e.target.value })} className={selectClass}>
                      <option value="">— No division —</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  )}
                  {regs.length > 1 && (
                    <button type="button" onClick={() => removeReg(i)} title="Remove"
                      className="text-lg leading-none px-1" style={{ color: "var(--sh-danger)" }}>×</button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addReg} className="text-sm underline" style={{ color: "var(--sh-primary)" }}>
                + Add to another season
              </button>
            </div>
          )}

          <StaffFields
            prefix="manager"
            label="Manager"
            required
            defaultValues={team.manager
              ? { name: team.manager.name, email: team.manager.email, phone: team.manager.phone }
              : undefined}
          />

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={managerPlays}
              onChange={(e) => setManagerPlays(e.target.checked)}
              className="w-4 h-4 rounded accent-green-500"
            />
            <span className="text-sm" style={{ color: "var(--sh-secondary)" }}>
              Manager also plays (Manager-player)
            </span>
          </label>

          {hasAssistant ? (
            <div className="space-y-2">
              <StaffFields
                prefix="assistant"
                label="Assistant"
                defaultValues={team.assistant
                  ? { name: team.assistant.name, email: team.assistant.email, phone: team.assistant.phone }
                  : undefined}
              />
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={assistantPlays}
                  onChange={(e) => setAssistantPlays(e.target.checked)}
                  className="w-4 h-4 rounded accent-indigo-500"
                />
                <span className="text-sm" style={{ color: "var(--sh-secondary)" }}>
                  Assistant also plays (Assistant-player)
                </span>
              </label>
              <button
                type="button"
                className="text-xs underline"
                style={{ color: "var(--sh-danger)" }}
                onClick={() => { setHasAssistant(false); setAssistantPlays(false); }}
              >
                Remove assistant
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="text-sm underline"
              style={{ color: "var(--sh-primary)" }}
              onClick={() => setHasAssistant(true)}
            >
              + Add assistant (optional)
            </button>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Saving…" : "Save changes"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
