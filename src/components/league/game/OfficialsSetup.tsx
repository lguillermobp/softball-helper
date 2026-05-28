"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/context/language-context";

interface UserOption { id: string; name: string | null; email: string }

interface Props {
  slug: string;
  gameId: string;
  fields: { id: string; name: string }[];
  umpireOptions: UserOption[];
  scorerOptions: UserOption[];
  initialFieldId: string | null;
  initialUmpireIds: string[];
  initialScorekeeperId: string | null;
  canEdit: boolean;
}

export function OfficialsSetup({
  slug, gameId, fields, umpireOptions, scorerOptions,
  initialFieldId, initialUmpireIds, initialScorekeeperId, canEdit,
}: Props) {
  const router = useRouter();
  const { t } = useLanguage();
  const ts = t.scoring;

  const [fieldId, setFieldId] = useState(initialFieldId ?? "");
  const [umpireIds, setUmpireIds] = useState<string[]>(initialUmpireIds);
  const [scorekeeperId, setScorekeeperId] = useState(initialScorekeeperId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const card  = { borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" };
  const card2 = { borderColor: "var(--sh-border)", background: "var(--sh-bg-card2)" };

  function addUmpire(id: string) {
    if (!id || umpireIds.includes(id) || umpireIds.length >= 2) return;
    setUmpireIds(prev => [...prev, id]);
  }
  function removeUmpire(id: string) { setUmpireIds(prev => prev.filter(x => x !== id)); }

  function umpireName(id: string) {
    const u = umpireOptions.find(u => u.id === id);
    return u ? (u.name ?? u.email) : id;
  }
  function scorerName(id: string) {
    const s = scorerOptions.find(s => s.id === id);
    return s ? (s.name ?? s.email) : id;
  }

  const availableUmpires = umpireOptions.filter(u => !umpireIds.includes(u.id));

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
      {!canEdit && (
        <div className="rounded-xl border px-4 py-3 text-sm" style={{ ...card2, color: "var(--sh-muted)" }}>
          {ts.readOnly}
        </div>
      )}

      {/* Field */}
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

      {/* Umpires */}
      <div className="rounded-2xl border p-5 space-y-3" style={card}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm uppercase tracking-wider" style={{ color: "var(--sh-muted)" }}>{ts.umpires}</h3>
          <span className="text-xs" style={{ color: "var(--sh-muted)" }}>{umpireIds.length}/2</span>
        </div>

        {/* Current umpires */}
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

        {/* Add umpire dropdown */}
        {canEdit && umpireIds.length < 2 && (
          <div className="flex gap-2">
            <select
              defaultValue=""
              onChange={e => { if (e.target.value) { addUmpire(e.target.value); e.target.value = ""; } }}
              className="flex-1 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">{ts.selectUmpire}</option>
              {availableUmpires.map(u => (
                <option key={u.id} value={u.id}>{u.name ?? u.email}</option>
              ))}
            </select>
          </div>
        )}

        {umpireOptions.length === 0 && (
          <p className="text-xs" style={{ color: "var(--sh-muted)" }}>No umpires registered in this league.</p>
        )}
      </div>

      {/* Scorekeeper */}
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

      {/* Save button */}
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
