"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ROLES = [
  { value: "LEAGUE_ADMIN", label: "League Admin" },
  { value: "UMPIRE",       label: "Umpire" },
  { value: "SCORER",       label: "Scorer" },
];

export function AddMemberDialog({ slug }: { slug: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleClose() { setOpen(false); setError(""); }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch(`/api/leagues/${slug}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name:  fd.get("name"),
        email: fd.get("email"),
        role:  fd.get("role"),
      }),
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
        <Button size="sm">+ Add member</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Member</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="name">Full name *</Label>
            <Input id="name" name="name" placeholder="Jane Smith" required />
            <p className="text-xs" style={{ color: "var(--sh-muted)" }}>
              Required if this person doesn&apos;t have an account yet.
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="email">Email address *</Label>
            <Input id="email" name="email" type="email" placeholder="user@example.com" required />
            <p className="text-xs" style={{ color: "var(--sh-muted)" }}>
              If they already have a Softball Helper account they will be linked automatically and notified. Otherwise an invitation to set up their profile will be sent.
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="role">Role *</Label>
            <select
              id="role"
              name="role"
              defaultValue="LEAGUE_ADMIN"
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Adding…" : "Add member"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
