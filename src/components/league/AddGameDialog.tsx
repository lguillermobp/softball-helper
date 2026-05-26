"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Team { id: string; name: string }
interface Category { id: string; name: string }

interface Props {
  slug: string;
  seasonId: string;
  teams: Team[];
  categories: Category[];
}

export function AddGameDialog({ slug, seasonId, teams, categories }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch(`/api/leagues/${slug}/games`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        seasonId,
        categoryId: fd.get("categoryId") || null,
        homeTeamId: fd.get("homeTeamId"),
        awayTeamId: fd.get("awayTeamId"),
        scheduledAt: fd.get("scheduledAt"),
        location: fd.get("location") || null,
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

  const selectClass =
    "w-full rounded-md border border-gray-300 bg-white text-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">+ Add game</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule a Game</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="homeTeamId">Home team *</Label>
              <select id="homeTeamId" name="homeTeamId" required className={selectClass}>
                <option value="">Select team</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="awayTeamId">Away team *</Label>
              <select id="awayTeamId" name="awayTeamId" required className={selectClass}>
                <option value="">Select team</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="scheduledAt">Date & time *</Label>
            <Input id="scheduledAt" name="scheduledAt" type="datetime-local" required />
          </div>

          <div className="space-y-1">
            <Label htmlFor="location">Location</Label>
            <Input id="location" name="location" placeholder="e.g. Field 3 - Central Park" />
          </div>

          {categories.length > 0 && (
            <div className="space-y-1">
              <Label htmlFor="categoryId">Category</Label>
              <select id="categoryId" name="categoryId" className={selectClass}>
                <option value="">All categories</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Saving…" : "Schedule game"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
