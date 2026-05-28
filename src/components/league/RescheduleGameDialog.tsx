"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/context/language-context";

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
  homeTeam: { name: string };
  awayTeam:  { name: string };
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

export function RescheduleGameDialog({ slug, game, teams, categories, fields }: Props) {
  const router = useRouter();
  const { t } = useLanguage();
  const tr = t.season.reschedule;
  const ts = t.season.schedule;

  const [open, setOpen]                 = useState(false);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState("");
  const [willBePlayed, setWillBePlayed] = useState(true);
  const [homeAwayTbd, setHomeAwayTbd]   = useState(game.homeAwayTbd);

  function handleClose() {
    setOpen(false);
    setError("");
    setWillBePlayed(true);
    setHomeAwayTbd(game.homeAwayTbd);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);

    const payload: Record<string, unknown> = { willBePlayed };
    if (willBePlayed) {
      payload.homeTeamId  = fd.get("homeTeamId");
      payload.awayTeamId  = fd.get("awayTeamId");
      payload.scheduledAt = fd.get("scheduledAt");
      payload.fieldId     = fd.get("fieldId") || null;
      payload.categoryId  = fd.get("categoryId") || null;
      payload.homeAwayTbd = homeAwayTbd;
    }

    const res = await fetch(`/api/leagues/${slug}/games/${game.id}/reschedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? tr.error);
      return;
    }
    handleClose();
    router.refresh();
  }

  const dim = { color: "var(--sh-muted)" };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true); }}>
      <DialogTrigger asChild>
        <button
          className="text-xs px-2 py-1 rounded-md border transition-colors hover:opacity-80"
          style={{ borderColor: "var(--sh-purple-border)", color: "var(--sh-purple)", background: "transparent" }}
        >
          {ts.reschedule}
        </button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tr.title}</DialogTitle>
        </DialogHeader>

        {/* Original game reference */}
        <div
          className="rounded-xl border px-4 py-3 text-sm mb-1"
          style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card2)" }}
        >
          <p className="font-semibold" style={{ color: "var(--sh-text)" }}>
            {game.homeTeam.name} <span style={dim}>vs</span> {game.awayTeam.name}
          </p>
          <p className="text-xs mt-0.5" style={dim}>
            📅 {new Date(game.scheduledAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 mt-1">

          {/* ── Will be played toggle ──────────────────────────────────── */}
          <div className="space-y-2">
            <p className="text-sm font-semibold" style={{ color: "var(--sh-text)" }}>{tr.willBePlayed}</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setWillBePlayed(true)}
                className="rounded-xl border p-3 text-left transition-all"
                style={willBePlayed
                  ? { borderColor: "var(--sh-primary)", background: "var(--sh-approved-bg)" }
                  : { borderColor: "var(--sh-border)", background: "transparent" }}
              >
                <p className="text-sm font-bold" style={{ color: willBePlayed ? "var(--sh-primary)" : "var(--sh-text)" }}>
                  ✅ {tr.yes}
                </p>
                <p className="text-xs mt-1" style={dim}>{tr.yesHint}</p>
              </button>
              <button
                type="button"
                onClick={() => setWillBePlayed(false)}
                className="rounded-xl border p-3 text-left transition-all"
                style={!willBePlayed
                  ? { borderColor: "var(--sh-danger)", background: "var(--sh-danger-bg)" }
                  : { borderColor: "var(--sh-border)", background: "transparent" }}
              >
                <p className="text-sm font-bold" style={{ color: !willBePlayed ? "var(--sh-danger)" : "var(--sh-text)" }}>
                  ❌ {tr.no}
                </p>
                <p className="text-xs mt-1" style={dim}>{tr.noHint}</p>
              </button>
            </div>
          </div>

          {/* ── New game details — only shown when game will be played ── */}
          {willBePlayed && <div className="space-y-4">
            <p className="text-sm font-semibold border-t pt-4" style={{ color: "var(--sh-text)", borderColor: "var(--sh-border)" }}>
              {tr.newDetails}
            </p>

            {/* Teams */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="homeTeamId">{homeAwayTbd ? "Team A" : t.season.schedule.home} *</Label>
                <select id="homeTeamId" name="homeTeamId" defaultValue={game.homeTeamId} required className={selectClass}>
                  <option value="">Select team</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="awayTeamId">{homeAwayTbd ? "Team B" : t.season.schedule.away} *</Label>
                <select id="awayTeamId" name="awayTeamId" defaultValue={game.awayTeamId} required className={selectClass}>
                  <option value="">Select team</option>
                  {teams.map(tm => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
                </select>
              </div>
            </div>

            {/* Home/Away TBD */}
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={homeAwayTbd}
                onChange={e => setHomeAwayTbd(e.target.checked)}
                className="accent-green-500 w-4 h-4"
              />
              <span className="text-sm" style={{ color: "var(--sh-text)" }}>
                Home / Away to be determined at game time
              </span>
            </label>

            {/* Date & time */}
            <div className="space-y-1">
              <Label htmlFor="scheduledAt">Date & time *</Label>
              <Input id="scheduledAt" name="scheduledAt" type="datetime-local" required />
            </div>

            {/* Field */}
            <div className="space-y-1">
              <Label htmlFor="fieldId">Field</Label>
              <select id="fieldId" name="fieldId" defaultValue={game.fieldId ?? ""} className={selectClass}>
                <option value="">— No field assigned —</option>
                {fields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>

            {/* Category */}
            {categories.length > 0 && (
              <div className="space-y-1">
                <Label htmlFor="categoryId">Category</Label>
                <select id="categoryId" name="categoryId" defaultValue={game.categoryId ?? ""} className={selectClass}>
                  <option value="">All categories</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
          </div>}

          {error && <p className="text-sm" style={{ color: "var(--sh-danger)" }}>{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button
              type="submit"
              disabled={loading}
              style={{ background: willBePlayed ? "var(--sh-purple)" : "var(--sh-danger)", color: "#fff" }}
            >
              {loading ? tr.submitting : tr.submit}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
