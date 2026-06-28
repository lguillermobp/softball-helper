"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface GamePreview {
  id: string;
  scheduledAt: string;
  status: string;
  homeTeam: { id: string; name: string };
  awayTeam: { id: string; name: string };
  field: { id: string; name: string } | null;
}

interface Field { id: string; name: string }

interface Props {
  slug: string;
  seasonId: string;
  games: GamePreview[];
  fields: Field[];
}

const dim = { color: "var(--sh-muted)" } as const;
const inputCls =
  "w-full rounded-md border px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-green-500";
const selectCls =
  "w-full rounded-md border px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-green-500";

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function isoDateStr(iso: string) {
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function BulkRescheduleDialog({ slug, seasonId, games, fields }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"select" | "confirm" | "done">("select");
  const [date, setDate] = useState("");
  const [fieldId, setFieldId] = useState("");
  const [newDate, setNewDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rescheduledCount, setRescheduledCount] = useState(0);

  function resetState() {
    setStep("select");
    setDate("");
    setFieldId("");
    setNewDate("");
    setError("");
    setLoading(false);
  }

  function handleOpenChange(v: boolean) {
    if (!v) resetState();
    setOpen(v);
  }

  const matchingGames = useMemo(() => {
    if (!date) return [];
    return games.filter(g => {
      if (g.status !== "SCHEDULED") return false;
      if (isoDateStr(g.scheduledAt) !== date) return false;
      if (fieldId && g.field?.id !== fieldId) return false;
      return true;
    });
  }, [games, date, fieldId]);

  const canReview =
    !!date && !!newDate && date !== newDate && matchingGames.length > 0;

  async function handleConfirm() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(
        `/api/leagues/${slug}/seasons/${seasonId}/bulk-reschedule`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, fieldId: fieldId || null, newDate }),
        }
      );
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to reschedule"); return; }
      setRescheduledCount(data.rescheduled);
      setStep("done");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const GameRow = ({ g }: { g: GamePreview }) => (
    <div
      className="flex items-center justify-between px-3 py-2 text-sm"
      style={{ background: "var(--sh-bg-card2)" }}
    >
      <span style={{ color: "var(--sh-text)" }}>
        {g.awayTeam.name}{" "}
        <span style={dim}>vs</span>{" "}
        {g.homeTeam.name}
      </span>
      <span className="text-xs" style={dim}>
        {fmtTime(g.scheduledAt)}
        {g.field ? ` · ${g.field.name}` : ""}
      </span>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="text-xs px-3 py-1.5 rounded-lg border hover:opacity-80 transition-opacity"
          style={{
            borderColor: "var(--sh-border2)",
            color: "var(--sh-secondary)",
            background: "transparent",
          }}
          title="Bulk reschedule games by date"
        >
          📅 Bulk Reschedule
        </button>
      </DialogTrigger>

      {open && (
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Reschedule</DialogTitle>
          </DialogHeader>

          {/* ── Step 1: select date + field ── */}
          {step === "select" && (
            <div className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide" style={dim}>
                  Original date
                </label>
                <input
                  type="date"
                  className={inputCls}
                  style={{ borderColor: "var(--sh-border2)", color: "var(--sh-text)" }}
                  value={date}
                  onChange={e => setDate(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide" style={dim}>
                  Filter by field (optional)
                </label>
                <select
                  className={selectCls}
                  style={{ borderColor: "var(--sh-border2)", color: "var(--sh-text)" }}
                  value={fieldId}
                  onChange={e => setFieldId(e.target.value)}
                >
                  <option value="">All fields</option>
                  {fields.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>

              {/* Preview */}
              {date && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide" style={dim}>
                    {matchingGames.length} scheduled game{matchingGames.length !== 1 ? "s" : ""} found
                    {fieldId ? ` · ${fields.find(f => f.id === fieldId)?.name ?? ""}` : ""}
                  </p>
                  {matchingGames.length === 0 ? (
                    <p
                      className="text-sm rounded-lg px-3 py-2"
                      style={{ background: "var(--sh-bg-card2)", color: "var(--sh-muted)" }}
                    >
                      No scheduled games on this date.
                    </p>
                  ) : (
                    <div
                      className="rounded-lg divide-y overflow-hidden max-h-40 overflow-y-auto"
                      style={{ border: "1px solid var(--sh-border)" }}
                    >
                      {matchingGames.map(g => <GameRow key={g.id} g={g} />)}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide" style={dim}>
                  New date
                </label>
                <input
                  type="date"
                  className={inputCls}
                  style={{ borderColor: "var(--sh-border2)", color: "var(--sh-text)" }}
                  value={newDate}
                  onChange={e => setNewDate(e.target.value)}
                />
                {date && newDate && date === newDate && (
                  <p className="text-xs" style={{ color: "var(--sh-danger, #ef4444)" }}>
                    New date must differ from original date.
                  </p>
                )}
              </div>

              {error && (
                <p className="text-sm" style={{ color: "var(--sh-danger, #ef4444)" }}>{error}</p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleOpenChange(false)}
                  className="flex-1 rounded-lg border py-2 text-sm font-semibold hover:opacity-80 transition-opacity"
                  style={{ borderColor: "var(--sh-border2)", color: "var(--sh-muted)", background: "transparent" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => { setError(""); setStep("confirm"); }}
                  disabled={!canReview}
                  className="flex-1 rounded-lg py-2 text-sm font-bold text-white transition-opacity disabled:opacity-40"
                  style={{ background: "var(--sh-primary-dark, #16a34a)" }}
                >
                  Review ({matchingGames.length})
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: confirm ── */}
          {step === "confirm" && (
            <div className="space-y-4 pt-1">
              <div
                className="rounded-xl p-4 space-y-2 text-sm"
                style={{ background: "var(--sh-bg-card2)", border: "1px solid var(--sh-border)" }}
              >
                <div className="flex justify-between">
                  <span style={dim}>Original date</span>
                  <span className="font-semibold" style={{ color: "var(--sh-text)" }}>{date}</span>
                </div>
                <div className="flex justify-between">
                  <span style={dim}>New date</span>
                  <span className="font-semibold" style={{ color: "var(--sh-primary)" }}>{newDate}</span>
                </div>
                {fieldId && (
                  <div className="flex justify-between">
                    <span style={dim}>Field</span>
                    <span className="font-semibold" style={{ color: "var(--sh-text)" }}>
                      {fields.find(f => f.id === fieldId)?.name ?? ""}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span style={dim}>Games affected</span>
                  <span className="font-semibold" style={{ color: "var(--sh-text)" }}>{matchingGames.length}</span>
                </div>
              </div>

              <div
                className="rounded-lg divide-y overflow-hidden max-h-48 overflow-y-auto"
                style={{ border: "1px solid var(--sh-border)" }}
              >
                {matchingGames.map(g => <GameRow key={g.id} g={g} />)}
              </div>

              <p
                className="text-xs rounded-lg px-3 py-2"
                style={{
                  background: "rgba(251,191,36,0.08)",
                  border: "1px solid rgba(251,191,36,0.25)",
                  color: "#fbbf24",
                }}
              >
                Original games will be marked <strong>Rescheduled</strong>. New copies are created on{" "}
                <strong>{newDate}</strong> preserving times and fields.
              </p>

              {error && (
                <p className="text-sm" style={{ color: "var(--sh-danger, #ef4444)" }}>{error}</p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setStep("select"); setError(""); }}
                  className="flex-1 rounded-lg border py-2 text-sm font-semibold hover:opacity-80 transition-opacity"
                  style={{ borderColor: "var(--sh-border2)", color: "var(--sh-muted)", background: "transparent" }}
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={loading}
                  className="flex-1 rounded-lg py-2 text-sm font-bold text-white transition-opacity disabled:opacity-50"
                  style={{ background: "var(--sh-primary-dark, #16a34a)" }}
                >
                  {loading
                    ? "Rescheduling…"
                    : `Confirm ${matchingGames.length} game${matchingGames.length !== 1 ? "s" : ""}`}
                </button>
              </div>
            </div>
          )}

          {/* ── Done ── */}
          {step === "done" && (
            <div className="flex flex-col items-center py-6 gap-3 text-center">
              <span className="text-4xl">✅</span>
              <p className="text-lg font-bold" style={{ color: "var(--sh-text)" }}>Done!</p>
              <p style={dim}>
                {rescheduledCount} game{rescheduledCount !== 1 ? "s" : ""} rescheduled to{" "}
                <strong style={{ color: "var(--sh-primary)" }}>{newDate}</strong>.
              </p>
              <button
                type="button"
                onClick={() => handleOpenChange(false)}
                className="mt-2 rounded-lg px-8 py-2 text-sm font-bold text-white"
                style={{ background: "var(--sh-primary-dark, #16a34a)" }}
              >
                Close
              </button>
            </div>
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}
