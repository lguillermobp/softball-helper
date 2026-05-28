"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/context/language-context";

interface UserOption { id: string; name: string | null; email: string }

interface Props {
  slug: string;
  gameId: string;
  // Team info
  homeTeam: { id: string; name: string };
  awayTeam:  { id: string; name: string };
  homeAwayTbd: boolean;
  canSwapTeams: boolean;
  gameStatus: string;
  // Officials
  fields: { id: string; name: string }[];
  umpireOptions: UserOption[];
  scorerOptions: UserOption[];
  initialFieldId: string | null;
  initialUmpireIds: string[];
  initialScorekeeperId: string | null;
  canEdit: boolean;
}

export function OfficialsSetup({
  slug, gameId,
  homeTeam, awayTeam, homeAwayTbd, canSwapTeams, gameStatus,
  fields, umpireOptions, scorerOptions,
  initialFieldId, initialUmpireIds, initialScorekeeperId, canEdit,
}: Props) {
  const router = useRouter();
  const { t } = useLanguage();
  const ts = t.scoring;

  // Teams swap state
  const [swapping, setSwapping]     = useState(false);
  const [swapError, setSwapError]   = useState("");

  // Officials state
  const [fieldId, setFieldId]           = useState(initialFieldId ?? "");
  const [umpireIds, setUmpireIds]       = useState<string[]>(initialUmpireIds);
  const [scorekeeperId, setScorekeeperId] = useState(initialScorekeeperId ?? "");
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState("");
  const [saved, setSaved]               = useState(false);

  const card  = { borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" };
  const card2 = { borderColor: "var(--sh-border)", background: "var(--sh-bg-card2)" };

  // ── Teams helpers ────────────────────────────────────────────────────────────
  async function handleTeamAction(action: "swap" | "confirm") {
    setSwapping(true);
    setSwapError("");
    const res = await fetch(`/api/leagues/${slug}/games/${gameId}/teams`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setSwapping(false);
    if (!res.ok) {
      const data = await res.json();
      setSwapError(data.error ?? ts.errorSwapTeams);
      return;
    }
    router.refresh();
  }

  // ── Officials helpers ────────────────────────────────────────────────────────
  function addUmpire(id: string) {
    if (!id || umpireIds.includes(id) || umpireIds.length >= 2) return;
    setUmpireIds(prev => [...prev, id]);
  }
  function removeUmpire(id: string) { setUmpireIds(prev => prev.filter(x => x !== id)); }

  function umpireName(id: string) {
    const u = umpireOptions.find(u => u.id === id);
    return u ? (u.name ?? u.email) : id;
  }

  const availableUmpires = umpireOptions.filter(u => !umpireIds.includes(u.id));

  const isActive = gameStatus === "SCHEDULED" || gameStatus === "IN_PROGRESS";

  async function handleSave() {
    setSaving(true); setError(""); setSaved(false);
    const res = await fetch(`/api/leagues/${slug}/games/${gameId}/officials`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        umpireIds,
        scorekeeperId: scorekeeperId || null,
        fieldId: fieldId || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? ts.errorSaveOfficials);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {!canEdit && !canSwapTeams && (
        <div className="rounded-xl border px-4 py-3 text-sm" style={{ ...card2, color: "var(--sh-muted)" }}>
          {ts.readOnly}
        </div>
      )}

      {/* ── Teams card ────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border p-5 space-y-4" style={card}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm uppercase tracking-wider" style={{ color: "var(--sh-muted)" }}>
            {ts.teams}
          </h3>
          {homeAwayTbd && (
            <span
              className="text-xs font-bold px-2.5 py-0.5 rounded-full"
              style={{ background: "var(--sh-warn-bg)", color: "var(--sh-warn)" }}
            >
              ⚠️ {ts.homeAwayTbdBadge}
            </span>
          )}
        </div>

        {/* Team tiles */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          {/* Home */}
          <div
            className="rounded-xl border p-3 text-center"
            style={{ borderColor: "var(--sh-border2)", background: "var(--sh-bg-card2)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--sh-primary)" }}>
              🏠 {ts.homeDesignation}
            </p>
            <p className="font-bold text-sm" style={{ color: "var(--sh-text)" }}>{homeTeam.name}</p>
          </div>

          {/* Swap icon */}
          <div className="text-center text-lg" style={{ color: "var(--sh-muted)" }}>⇄</div>

          {/* Away */}
          <div
            className="rounded-xl border p-3 text-center"
            style={{ borderColor: "var(--sh-border2)", background: "var(--sh-bg-card2)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--sh-info)" }}>
              ✈️ {ts.awayDesignation}
            </p>
            <p className="font-bold text-sm" style={{ color: "var(--sh-text)" }}>{awayTeam.name}</p>
          </div>
        </div>

        {/* Action buttons */}
        {canSwapTeams && isActive && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => handleTeamAction("swap")}
              disabled={swapping}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border font-semibold transition-all hover:opacity-80 disabled:opacity-40"
              style={{ borderColor: "var(--sh-border2)", color: "var(--sh-primary)", background: "transparent" }}
            >
              🔄 {swapping ? ts.swapping : ts.swapTeams}
            </button>

            {homeAwayTbd && (
              <button
                onClick={() => handleTeamAction("confirm")}
                disabled={swapping}
                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-semibold transition-all hover:opacity-80 disabled:opacity-40"
                style={{ background: "linear-gradient(135deg,#16a34a,#15803d)", color: "#fff" }}
              >
                ✓ {ts.confirmDesignation}
              </button>
            )}

            {swapError && (
              <p className="text-xs w-full mt-1" style={{ color: "var(--sh-danger)" }}>{swapError}</p>
            )}
          </div>
        )}
      </div>

      {/* ── Field ─────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border p-5 space-y-3" style={card}>
        <h3 className="font-semibold text-sm uppercase tracking-wider" style={{ color: "var(--sh-muted)" }}>{ts.field}</h3>
        <select
          value={fieldId}
          onChange={e => setFieldId(e.target.value)}
          disabled={!canEdit}
          className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
        >
          <option value="">{ts.selectField}</option>
          {fields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </div>

      {/* ── Umpires ───────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border p-5 space-y-3" style={card}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm uppercase tracking-wider" style={{ color: "var(--sh-muted)" }}>{ts.umpires}</h3>
          <span className="text-xs" style={{ color: "var(--sh-muted)" }}>{umpireIds.length}/2</span>
        </div>

        {umpireIds.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {umpireIds.map(id => (
              <span
                key={id}
                className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full font-medium"
                style={{ background: "var(--sh-approved-bg)", color: "var(--sh-primary)", border: "1px solid var(--sh-border2)" }}
              >
                ⚖️ {umpireName(id)}
                {canEdit && (
                  <button onClick={() => removeUmpire(id)} className="hover:opacity-70 ml-1" style={{ color: "var(--sh-danger)" }}>×</button>
                )}
              </span>
            ))}
          </div>
        )}

        {canEdit && umpireIds.length < 2 && (
          <select
            defaultValue=""
            onChange={e => { if (e.target.value) { addUmpire(e.target.value); e.target.value = ""; } }}
            className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">{ts.selectUmpire}</option>
            {availableUmpires.map(u => (
              <option key={u.id} value={u.id}>{u.name ?? u.email}</option>
            ))}
          </select>
        )}

        {umpireOptions.length === 0 && (
          <p className="text-xs" style={{ color: "var(--sh-muted)" }}>No umpires registered in this league.</p>
        )}
      </div>

      {/* ── Scorekeeper ───────────────────────────────────────────────────── */}
      <div className="rounded-2xl border p-5 space-y-3" style={card}>
        <h3 className="font-semibold text-sm uppercase tracking-wider" style={{ color: "var(--sh-muted)" }}>{ts.scorekeeper}</h3>
        <select
          value={scorekeeperId}
          onChange={e => setScorekeeperId(e.target.value)}
          disabled={!canEdit}
          className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
        >
          <option value="">{ts.selectScorekeeper}</option>
          {scorerOptions.map(s => (
            <option key={s.id} value={s.id}>{s.name ?? s.email}</option>
          ))}
        </select>
        {scorerOptions.length === 0 && (
          <p className="text-xs" style={{ color: "var(--sh-muted)" }}>No scorekeepers registered in this league.</p>
        )}
      </div>

      {/* ── Save button ───────────────────────────────────────────────────── */}
      {canEdit && (
        <div className="flex items-center justify-end gap-3">
          {saved && <span className="text-sm" style={{ color: "var(--sh-primary)" }}>✓ Saved</span>}
          {error && <span className="text-sm" style={{ color: "var(--sh-danger)" }}>{error}</span>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#16a34a,#15803d)", color: "#fff" }}
          >
            {saving ? "Saving…" : ts.saveSetup}
          </button>
        </div>
      )}
    </div>
  );
}
