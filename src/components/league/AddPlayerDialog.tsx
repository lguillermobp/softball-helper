"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COUNTRIES, flagEmoji } from "@/lib/countries";

interface Props {
  slug: string;
  teamId: string;
  teamName: string;
}

export function AddPlayerDialog({ slug, teamId, teamName }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch(`/api/leagues/${slug}/players`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        email: fd.get("email"),
        jerseyNumber: fd.get("jerseyNumber") || null,
        nationality: fd.get("nationality") || null,
        teamId,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Something went wrong");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">+ Add player</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Player to {teamName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="name">Full name *</Label>
            <Input id="name" name="name" placeholder="Jane Smith" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="email">Email address</Label>
            <Input id="email" name="email" type="email" placeholder="player@example.com (optional)" />
            <p className="text-xs" style={{ color: "var(--sh-muted)" }}>
              Optional. If provided, the player will be linked to their account or receive an invitation. Can be added later.
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="jerseyNumber">Jersey number</Label>
            <Input id="jerseyNumber" name="jerseyNumber" placeholder="e.g. 7" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="nationality">Nationality</Label>
            <select id="nationality" name="nationality"
              className="w-full rounded-md border px-3 py-2 text-sm outline-none"
              style={{ background: "var(--sh-bg-card2)", borderColor: "var(--sh-border)", color: "var(--sh-text)" }}>
              <option value="">— None —</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{flagEmoji(c.code)} {c.name}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Adding…" : "Add player"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
