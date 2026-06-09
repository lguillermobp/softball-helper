"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COUNTRIES } from "@/lib/countries";

interface Player {
  id: string;
  name: string;
  email: string | null;
  jerseyNumber: string | null;
  nationality: string | null;
  dob: string | null;
}

interface Props {
  slug: string;
  player: Player;
}

export function EditPlayerDialog({ slug, player }: Props) {
  const router = useRouter();
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch(`/api/leagues/${slug}/players/${player.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name:         fd.get("name"),
        email:        fd.get("email"),
        jerseyNumber: fd.get("jerseyNumber") || null,
        nationality:  fd.get("nationality") || null,
        dob:          fd.get("dob") || null,
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
        <button
          className="text-xs px-2 py-1 rounded-md border hover:opacity-80"
          style={{ borderColor: "var(--sh-border2)", color: "var(--sh-primary)", background: "transparent" }}
        >
          Edit
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Player</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="ep-name">Full name *</Label>
            <Input id="ep-name" name="name" defaultValue={player.name} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ep-email">Email address</Label>
            <Input id="ep-email" name="email" type="email" defaultValue={player.email ?? ""} placeholder="player@example.com (optional)" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ep-jersey">Jersey number</Label>
            <Input id="ep-jersey" name="jerseyNumber" defaultValue={player.jerseyNumber ?? ""} placeholder="e.g. 7" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ep-dob">Date of birth</Label>
            <Input id="ep-dob" name="dob" type="date"
              defaultValue={player.dob ? player.dob.slice(0, 10) : ""} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ep-nationality">Nationality</Label>
            <select id="ep-nationality" name="nationality" defaultValue={player.nationality ?? ""}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none"
              style={{ background: "var(--sh-bg-card2)", borderColor: "var(--sh-border)", color: "var(--sh-text)" }}>
              <option value="">— None —</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm" style={{ color: "#f87171" }}>{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Saving…" : "Save"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
