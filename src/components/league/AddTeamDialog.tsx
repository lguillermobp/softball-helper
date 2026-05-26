"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Season { id: string; name: string }
interface Category { id: string; name: string }

const selectClass =
  "w-full rounded-md border border-gray-300 bg-white text-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500";

function StaffFields({ prefix, label, required }: { prefix: string; label: string; required?: boolean }) {
  return (
    <div className="space-y-3 rounded-xl p-3" style={{ background: "#0a1a0a", border: "1px solid #1e3a1e" }}>
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#4ade80" }}>
        {label}{required && " *"}
      </p>
      <div className="space-y-1">
        <Label htmlFor={`${prefix}-name`}>Full name {required && "*"}</Label>
        <Input id={`${prefix}-name`} name={`${prefix}-name`} placeholder="Jane Smith" required={required} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${prefix}-email`}>Email address {required && "*"}</Label>
        <Input id={`${prefix}-email`} name={`${prefix}-email`} type="email" placeholder="jane@example.com" required={required} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${prefix}-phone`}>Mobile phone (optional)</Label>
        <Input id={`${prefix}-phone`} name={`${prefix}-phone`} type="tel" placeholder="+1 555 000 0000" />
      </div>
    </div>
  );
}

export function AddTeamDialog({ slug, seasons, categories }: {
  slug: string;
  seasons: Season[];
  categories: Category[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasAssistant, setHasAssistant] = useState(false);

  function handleClose() { setOpen(false); setHasAssistant(false); setError(""); }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);

    const body: Record<string, unknown> = {
      name: fd.get("name"),
      seasonId: fd.get("seasonId") || undefined,
      categoryId: fd.get("categoryId") || undefined,
      manager: {
        name: fd.get("manager-name"),
        email: fd.get("manager-email"),
        phone: fd.get("manager-phone") || undefined,
      },
    };

    if (hasAssistant) {
      body.assistant = {
        name: fd.get("assistant-name"),
        email: fd.get("assistant-email"),
        phone: fd.get("assistant-phone") || undefined,
      };
    }

    const res = await fetch(`/api/leagues/${slug}/teams`, {
      method: "POST",
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
        <Button size="sm">+ Add team</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Team</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="name">Team name *</Label>
            <Input id="name" name="name" placeholder="e.g. Tigers" required />
          </div>

          {seasons.length > 0 && (
            <div className="space-y-1">
              <Label htmlFor="seasonId">Season (optional)</Label>
              <select id="seasonId" name="seasonId" className={selectClass}>
                <option value="">— No season —</option>
                {seasons.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}

          {categories.length > 0 && (
            <div className="space-y-1">
              <Label htmlFor="categoryId">Category (optional)</Label>
              <select id="categoryId" name="categoryId" className={selectClass}>
                <option value="">— No category —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          <StaffFields prefix="manager" label="Manager" required />

          {hasAssistant ? (
            <div className="space-y-2">
              <StaffFields prefix="assistant" label="Assistant" />
              <button
                type="button"
                className="text-xs underline"
                style={{ color: "#f87171" }}
                onClick={() => setHasAssistant(false)}
              >
                Remove assistant
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="text-sm underline"
              style={{ color: "#4ade80" }}
              onClick={() => setHasAssistant(true)}
            >
              + Add assistant (optional)
            </button>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Saving…" : "Create team"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
