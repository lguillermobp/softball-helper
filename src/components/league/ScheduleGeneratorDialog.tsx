"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface FieldSlot {
  id: string; name: string;
  slotStartTime: string | null; slotDurationMins: number;
  slotsMonday: number; slotsTuesday: number; slotsWednesday: number;
  slotsThursday: number; slotsFriday: number; slotsSaturday: number; slotsSunday: number;
}

interface Props {
  slug: string;
  seasonId: string;
  seasonName: string;
  seasonStart: string;
  seasonEnd: string;
  fields: FieldSlot[];
  teamCount: number;
}

interface ProposedGame {
  twinId: string; gameNum: 1 | 2; date: string; fieldId: string; fieldName: string;
  startTime: string; homeTeamId: string; homeTeamName: string; awayTeamId: string; awayTeamName: string;
}
interface TeamSummary { teamId: string; teamName: string; games: number; twins: number }
interface PairSummary { key: string; teamA: string; teamB: string; twins: number }
interface GenerateResult {
  games: ProposedGame[]; teamSummary: TeamSummary[]; pairSummary: PairSummary[];
  totalSlots: number; scheduledSlots: number; warnings: string[];
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function fieldWeeklySlots(f: FieldSlot) {
  return f.slotsMonday + f.slotsTuesday + f.slotsWednesday + f.slotsThursday + f.slotsFriday + f.slotsSaturday + f.slotsSunday;
}

export function ScheduleGeneratorDialog({ slug, seasonId, seasonName, seasonStart, seasonEnd, fields, teamCount }: Props) {
  const router = useRouter();
  const [open, setOpen]       = useState(false);
  const [step, setStep]       = useState<1 | 2 | 3>(1);
  const [startDate, setStart] = useState(seasonStart.slice(0, 10));
  const [endDate, setEnd]     = useState(seasonEnd.slice(0, 10));
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [result, setResult]         = useState<GenerateResult | null>(null);
  const [genError, setGenError]     = useState("");
  const [saveError, setSaveError]   = useState("");

  const configurableFields = fields.filter(f => f.slotStartTime);
  const totalWeeklySlots   = configurableFields.reduce((s, f) => s + fieldWeeklySlots(f), 0);

  async function handleGenerate() {
    setGenerating(true); setGenError("");
    const res = await fetch(`/api/leagues/${slug}/seasons/${seasonId}/generate-schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startDate, endDate }),
    });
    setGenerating(false);
    if (!res.ok) { const d = await res.json(); setGenError(d.error ?? "Generation failed"); return; }
    const data: GenerateResult = await res.json();
    setResult(data);
    setStep(2);
  }

  async function handleSave() {
    if (!result) return;
    setSaving(true); setSaveError("");
    const res = await fetch(`/api/leagues/${slug}/seasons/${seasonId}/save-schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ games: result.games }),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setSaveError(d.error ?? "Save failed"); return; }
    setStep(3);
    router.refresh();
  }

  function reset() { setStep(1); setResult(null); setGenError(""); setSaveError(""); }

  const inputStyle = { borderColor: "var(--sh-border)", background: "var(--sh-bg-card2)", color: "var(--sh-text)" };
  const inputCls   = "w-full rounded-lg border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500";

  // Group games by date for preview
  const byDate = result
    ? result.games.reduce<Record<string, ProposedGame[]>>((acc, g) => {
        (acc[g.date] ??= []).push(g);
        return acc;
      }, {})
    : {};

  return (
    <>
      <button
        onClick={() => { setOpen(true); reset(); }}
        className="text-xs px-3 py-1.5 rounded-lg border font-semibold transition-colors hover:opacity-80"
        style={{ borderColor: "var(--sh-primary)", color: "var(--sh-primary)", background: "transparent" }}
      >
        ⚡ Generate Schedule
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.65)" }}>
          <div className="w-full max-w-3xl rounded-2xl border flex flex-col" style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card)", maxHeight: "90vh" }}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--sh-border)" }}>
              <div>
                <h2 className="text-lg font-bold" style={{ color: "var(--sh-text)" }}>Schedule Generator</h2>
                <p className="text-xs" style={{ color: "var(--sh-muted)" }}>{seasonName}</p>
              </div>
              <div className="flex items-center gap-4">
                {/* Step indicator */}
                <div className="flex items-center gap-2">
                  {[1, 2, 3].map(s => (
                    <div key={s} className="flex items-center gap-1">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{
                          background: step >= s ? "var(--sh-primary)" : "var(--sh-bg-card2)",
                          color: step >= s ? "#fff" : "var(--sh-muted)",
                        }}>
                        {s}
                      </div>
                      {s < 3 && <div className="w-6 h-px" style={{ background: step > s ? "var(--sh-primary)" : "var(--sh-border)" }} />}
                    </div>
                  ))}
                </div>
                <button onClick={() => setOpen(false)} className="text-xl" style={{ color: "var(--sh-muted)" }}>×</button>
              </div>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 p-6 space-y-5">

              {/* ── Step 1: Config ── */}
              {step === 1 && (
                <>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--sh-primary)" }}>Start date</label>
                      <input type="date" value={startDate} onChange={e => setStart(e.target.value)} className={inputCls} style={inputStyle} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--sh-primary)" }}>End date</label>
                      <input type="date" value={endDate} onChange={e => setEnd(e.target.value)} className={inputCls} style={inputStyle} />
                    </div>
                  </div>

                  {/* Field summary */}
                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--sh-primary)" }}>
                      Field availability ({configurableFields.length} of {fields.length} configured)
                    </p>
                    {fields.length === 0 ? (
                      <p className="text-sm" style={{ color: "var(--sh-muted)" }}>No fields in this league. Add fields with slot config first.</p>
                    ) : (
                      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--sh-border)" }}>
                        <table className="w-full text-xs">
                          <thead>
                            <tr style={{ background: "var(--sh-bg-card2)", borderBottom: "1px solid var(--sh-border)" }}>
                              <th className="px-3 py-2 text-left font-semibold" style={{ color: "var(--sh-muted)" }}>Field</th>
                              <th className="px-3 py-2 text-left font-semibold" style={{ color: "var(--sh-muted)" }}>Start</th>
                              <th className="px-3 py-2 text-left font-semibold" style={{ color: "var(--sh-muted)" }}>Duration</th>
                              {DAY_NAMES.map(d => <th key={d} className="px-2 py-2 text-center font-semibold" style={{ color: "var(--sh-muted)" }}>{d}</th>)}
                              <th className="px-3 py-2 text-center font-semibold" style={{ color: "var(--sh-muted)" }}>Wk</th>
                            </tr>
                          </thead>
                          <tbody>
                            {fields.map(f => {
                              const dayCounts = [f.slotsSunday, f.slotsMonday, f.slotsTuesday, f.slotsWednesday, f.slotsThursday, f.slotsFriday, f.slotsSaturday];
                              const wk = fieldWeeklySlots(f);
                              return (
                                <tr key={f.id} style={{ borderBottom: "1px solid var(--sh-border)" }}>
                                  <td className="px-3 py-2 font-medium" style={{ color: "var(--sh-text)" }}>{f.name}</td>
                                  <td className="px-3 py-2" style={{ color: f.slotStartTime ? "var(--sh-text)" : "var(--sh-muted)" }}>{f.slotStartTime ?? "—"}</td>
                                  <td className="px-3 py-2" style={{ color: "var(--sh-muted)" }}>{f.slotStartTime ? `${f.slotDurationMins}m` : "—"}</td>
                                  {dayCounts.map((c, i) => (
                                    <td key={i} className="px-2 py-2 text-center" style={{ color: c > 0 ? "var(--sh-primary)" : "var(--sh-muted)" }}>
                                      {c > 0 ? c : "·"}
                                    </td>
                                  ))}
                                  <td className="px-3 py-2 text-center font-bold" style={{ color: wk > 0 ? "var(--sh-primary)" : "var(--sh-muted)" }}>{wk}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "var(--sh-bg-card2)" }}>
                    <span className="text-2xl">🏟️</span>
                    <div className="text-sm" style={{ color: "var(--sh-muted)" }}>
                      <strong style={{ color: "var(--sh-text)" }}>{teamCount} teams</strong> · {configurableFields.length} field(s) · {totalWeeklySlots} weekly twin slots
                    </div>
                  </div>

                  {genError && <p className="text-sm" style={{ color: "var(--sh-danger)" }}>{genError}</p>}
                </>
              )}

              {/* ── Step 2: Preview ── */}
              {step === 2 && result && (
                <>
                  {/* Summary */}
                  <div className="grid sm:grid-cols-3 gap-3">
                    {[
                      { label: "Total games", value: result.games.length },
                      { label: "Twins scheduled", value: result.scheduledSlots },
                      { label: "Empty slots", value: result.totalSlots - result.scheduledSlots },
                    ].map(s => (
                      <div key={s.label} className="rounded-xl border p-3 text-center" style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card2)" }}>
                        <p className="text-2xl font-black" style={{ color: "var(--sh-primary)" }}>{s.value}</p>
                        <p className="text-xs" style={{ color: "var(--sh-muted)" }}>{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Warnings */}
                  {result.warnings.length > 0 && (
                    <div className="rounded-xl border p-3 space-y-1" style={{ borderColor: "#b45309", background: "#451a03" }}>
                      <p className="text-xs font-bold" style={{ color: "#fbbf24" }}>⚠ {result.warnings.length} slot(s) could not be filled</p>
                      {result.warnings.slice(0, 5).map((w, i) => <p key={i} className="text-xs" style={{ color: "#fcd34d" }}>{w}</p>)}
                      {result.warnings.length > 5 && <p className="text-xs" style={{ color: "#fbbf24" }}>…and {result.warnings.length - 5} more</p>}
                    </div>
                  )}

                  {/* Team balance */}
                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--sh-primary)" }}>Team game counts</p>
                    <div className="flex flex-wrap gap-2">
                      {result.teamSummary.map(t => (
                        <div key={t.teamId} className="rounded-lg border px-3 py-1.5 text-xs" style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card2)" }}>
                          <span style={{ color: "var(--sh-text)" }}>{t.teamName}</span>
                          <span className="ml-2 font-bold" style={{ color: "var(--sh-primary)" }}>{t.games}G</span>
                          <span className="ml-1" style={{ color: "var(--sh-muted)" }}>({t.twins} twins)</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Schedule by date */}
                  <div className="space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--sh-primary)" }}>Proposed schedule</p>
                    {Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, games]) => {
                      const d = new Date(date + "T12:00:00");
                      const twins: ProposedGame[][] = [];
                      const seen = new Set<string>();
                      games.forEach(g => {
                        if (!seen.has(g.twinId)) { twins.push(games.filter(x => x.twinId === g.twinId)); seen.add(g.twinId); }
                      });
                      return (
                        <div key={date} className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--sh-border)" }}>
                          <div className="px-4 py-2 text-xs font-bold" style={{ background: "var(--sh-bg-card2)", color: "var(--sh-secondary)" }}>
                            {d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" })}
                            <span className="ml-2 font-normal" style={{ color: "var(--sh-muted)" }}>· {twins.length} twin(s)</span>
                          </div>
                          <div className="divide-y" style={{ borderColor: "var(--sh-border)" }}>
                            {twins.map((pair, ti) => (
                              <div key={ti} className="px-4 py-2 space-y-1">
                                <div className="flex items-center gap-2 text-xs" style={{ color: "var(--sh-muted)" }}>
                                  <span>📍 {pair[0].fieldName}</span>
                                  <span>·</span>
                                  <span style={{ color: "#a78bfa" }}>Twin {ti + 1}</span>
                                </div>
                                {pair.map(g => (
                                  <div key={g.gameNum} className="flex items-center gap-3 text-sm">
                                    <span className="w-12 text-xs font-mono shrink-0" style={{ color: "var(--sh-muted)" }}>{g.startTime}</span>
                                    <span className="font-medium" style={{ color: "var(--sh-text)" }}>{g.homeTeamName}</span>
                                    <span className="text-xs" style={{ color: "var(--sh-muted)" }}>vs</span>
                                    <span className="font-medium" style={{ color: "var(--sh-text)" }}>{g.awayTeamName}</span>
                                    <span className="ml-auto text-xs" style={{ color: "var(--sh-muted)" }}>Game {g.gameNum}</span>
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {saveError && <p className="text-sm" style={{ color: "var(--sh-danger)" }}>{saveError}</p>}
                </>
              )}

              {/* ── Step 3: Done ── */}
              {step === 3 && (
                <div className="text-center py-10">
                  <div className="text-6xl mb-4">⚾</div>
                  <h3 className="text-xl font-black mb-2" style={{ color: "var(--sh-primary)" }}>Schedule saved!</h3>
                  <p className="text-sm" style={{ color: "var(--sh-muted)" }}>
                    {result?.games.length} games added to the season schedule.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t flex items-center justify-between" style={{ borderColor: "var(--sh-border)" }}>
              <button onClick={() => setOpen(false)} className="text-sm px-4 py-2 rounded-lg" style={{ color: "var(--sh-muted)" }}>
                {step === 3 ? "Close" : "Cancel"}
              </button>
              <div className="flex items-center gap-3">
                {step === 2 && (
                  <button onClick={() => setStep(1)}
                    className="text-sm px-4 py-2 rounded-lg border"
                    style={{ borderColor: "var(--sh-border2)", color: "var(--sh-muted)" }}>
                    ← Back
                  </button>
                )}
                {step === 1 && (
                  <button onClick={handleGenerate} disabled={generating || configurableFields.length === 0}
                    className="px-6 py-2 rounded-xl font-bold text-sm disabled:opacity-40"
                    style={{ background: "linear-gradient(135deg,#16a34a,#15803d)", color: "#fff" }}>
                    {generating ? "Generating…" : "Generate →"}
                  </button>
                )}
                {step === 2 && (
                  <button onClick={handleSave} disabled={saving || !result?.games.length}
                    className="px-6 py-2 rounded-xl font-bold text-sm disabled:opacity-40"
                    style={{ background: "linear-gradient(135deg,#16a34a,#15803d)", color: "#fff" }}>
                    {saving ? "Saving…" : `Save ${result?.games.length} games →`}
                  </button>
                )}
                {step === 3 && (
                  <button onClick={() => { setOpen(false); reset(); }}
                    className="px-6 py-2 rounded-xl font-bold text-sm"
                    style={{ background: "linear-gradient(135deg,#16a34a,#15803d)", color: "#fff" }}>
                    Done
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
