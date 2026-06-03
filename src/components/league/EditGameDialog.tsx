"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Team     { id: string; name: string }
interface Category { id: string; name: string }
interface Field    { id: string; name: string }

interface GameData {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  fieldId: string | null;
  categoryId: string | null;
  scheduledAt: string;
  homeAwayTbd: boolean;
}

interface Props {
  slug: string;
  game: GameData;
  teams: Team[];
  categories: Category[];
  fields: Field[];
}

const selectClass =
  "w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500";

function toDatetimeLocal(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EditGameDialog({ slug, game, teams, categories, fields }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [homeAwayTbd, setHomeAwayTbd] = useState(game.homeAwayTbd);

  function handleClose() { setOpen(false); setError(""); }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch(`/api/leagues/${slug}/games/${game.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        homeTeamId:  fd.get("homeTeamId"),
        awayTeamId:  fd.get("awayTeamId"),
        fieldId:     fd.get("fieldId") || null,
        categoryId:  fd.get("categoryId") || null,
        scheduledAt: new Date(fd.get("scheduledAt") as string).toISOString(),
        homeAwayTbd,
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
        <button
          className="text-xs px-2 py-1 rounded-md border transition-colors hover:opacity-80"
          style={{ borderColor: "var(--sh-border2)", color: "var(--sh-primary)", background: "transparent" }}
        >
          Edit
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Game</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="homeTeamId">{homeAwayTbd ? "Team A" : "Home team"} *</Label>
              <select id="homeTeamId" name="homeTeamId" defaultValue={game.homeTeamId} required className={selectClass}>
                <option value="">Select team</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="awayTeamId">{homeAwayTbd ? "Team B" : "Away team"} *</Label>
              <select id="awayTeamId" name="awayTeamId" defaultValue={game.awayTeamId} required className={selectClass}>
                <option value="">Select team</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={homeAwayTbd}
              onChange={(e) => setHomeAwayTbd(e.target.checked)}
              className="accent-green-500 w-4 h-4"
            />
            <span className="text-sm" style={{ color: "var(--sh-text)" }}>
              Home / Away to be determined at game time
            </span>
          </label>

          <div className="space-y-1">
            <Label htmlFor="scheduledAt">Date & time *</Label>
            <Input
              id="scheduledAt"
              name="scheduledAt"
              type="datetime-local"
              defaultValue={toDatetimeLocal(game.scheduledAt)}
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="fieldId">Field</Label>
            <select id="fieldId" name="fieldId" defaultValue={game.fieldId ?? ""} className={selectClass}>
              <option value="">— No field assigned —</option>
              {fields.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>

          {categories.length > 0 && (
            <div className="space-y-1">
              <Label htmlFor="categoryId">Category</Label>
              <select id="categoryId" name="categoryId" defaultValue={game.categoryId ?? ""} className={selectClass}>
                <option value="">All categories</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
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
