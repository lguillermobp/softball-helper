"use client";

import { useState, useEffect, useCallback } from "react";

interface Named { id: string; name: string }
interface RosterPlayer { prospectId: string; name: string; isKeeper: boolean; score: number | null }
interface Board {
  draft: {
    id: string; status: string; snake: boolean; currentPick: number; target: number | null;
    pickOrder: Named[]; onClock: Named | null; next: Named | null;
    teamsTotal: number; prospectsTotal: number; picksMade: number;
  };
  teams: Named[];
  rosters: { id: string; name: string; players: RosterPlayer[] }[];
  available: { id: string; name: string; score: number | null; tier: number }[];
  tiers: { label: string; min: number; max: number }[];
}

const card = { borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" };
const chip = "text-xs px-2.5 py-1 rounded-md border";
const inputStyle = { borderColor: "var(--sh-border)", background: "var(--sh-bg-card2)", color: "var(--sh-text)" };

export function DraftBoardView({ slug, draftId }: { slug: string; draftId: string }) {
  const base = `/api/leagues/${slug}/drafts/${draftId}`;
  const [b, setB] = useState<Board | null>(null);
  const [err, setErr] = useState("");
  const [keeperTeam, setKeeperTeam] = useState("");
  const [keeperProspect, setKeeperProspect] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(base);
    if (res.ok) setB(await res.json());
  }, [base]);

  useEffect(() => {
    void load();
    const id = setInterval(() => { void load(); }, 2000);
    return () => clearInterval(id);
  }, [load]);

  async function act(path: string, body?: unknown, method = "POST") {
    setErr("");
    const res = await fetch(`${base}${path}`, { method, headers: body ? { "Content-Type": "application/json" } : {}, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!res.ok) { setErr((await res.json().catch(() => ({}))).error ?? "Something went wrong"); return false; }
    await load();
    return true;
  }

  if (!b) return <p style={{ color: "var(--sh-muted)" }}>Loading…</p>;
  const { draft, rosters, available, tiers } = b;
  const status = draft.status;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-black" style={{ color: "var(--sh-text)" }}>Draft</h1>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{
          background: status === "LIVE" ? "rgba(74,222,128,.14)" : status === "DONE" ? "rgba(96,165,250,.14)" : "var(--sh-bg-card2)",
          color: status === "LIVE" ? "#4ade80" : status === "DONE" ? "#60a5fa" : "var(--sh-muted)",
        }}>{status === "LIVE" ? "Live" : status === "DONE" ? "Complete" : "Setup"}</span>
      </div>
      {err && <p className="text-sm" style={{ color: "#f87171" }}>{err}</p>}

      {/* ── SETUP ── */}
      {status === "SETUP" && (
        <>
          <section className="rounded-xl border p-4" style={card}>
            <div className="flex items-center justify-between gap-3 mb-2">
              <h2 className="font-bold" style={{ color: "var(--sh-text)" }}>Pick order (lottery)</h2>
              <button onClick={() => act("/draw")} className={chip} style={{ borderColor: "var(--sh-border2)", color: "var(--sh-primary)" }}>{draft.pickOrder.length ? "Re-draw" : "Draw lots"}</button>
            </div>
            {draft.pickOrder.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--sh-muted)" }}>Draw lots to set the order. (Make sure the division&apos;s teams exist first.)</p>
            ) : (
              <ol className="flex flex-wrap gap-2">
                {draft.pickOrder.map((t, i) => (
                  <li key={t.id} className="text-sm px-3 py-1 rounded-full" style={{ background: "var(--sh-bg-card2)", color: "var(--sh-text)" }}>{i + 1}. {t.name}</li>
                ))}
              </ol>
            )}
          </section>

          <section className="rounded-xl border p-4" style={card}>
            <h2 className="font-bold mb-1" style={{ color: "var(--sh-text)" }}>Keepers</h2>
            <p className="text-xs mb-3" style={{ color: "var(--sh-muted)" }}>Assign returning players or family members directly to a team. They count toward that team&apos;s roster.</p>
            <div className="space-y-2 mb-3">
              {rosters.map((r) => r.players.filter((p) => p.isKeeper).length > 0 && (
                <div key={r.id} className="text-sm">
                  <span className="font-semibold" style={{ color: "var(--sh-text)" }}>{r.name}:</span>{" "}
                  {r.players.filter((p) => p.isKeeper).map((p) => (
                    <span key={p.prospectId} className="inline-flex items-center gap-1 mr-2" style={{ color: "var(--sh-secondary)" }}>
                      {p.name}
                      <button onClick={() => act(`/keepers?prospectId=${p.prospectId}`, undefined, "DELETE")} style={{ color: "#f87171" }}>✕</button>
                    </span>
                  ))}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select className="rounded-md border px-3 py-1.5 text-sm" style={inputStyle} value={keeperTeam} onChange={(e) => setKeeperTeam(e.target.value)}>
                <option value="">— Team —</option>
                {b.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <select className="rounded-md border px-3 py-1.5 text-sm" style={inputStyle} value={keeperProspect} onChange={(e) => setKeeperProspect(e.target.value)}>
                <option value="">— Prospect —</option>
                {available.map((p) => <option key={p.id} value={p.id}>{p.name}{p.score != null ? ` (${p.score})` : ""}</option>)}
              </select>
              <button onClick={async () => { if (keeperTeam && keeperProspect && await act("/keepers", { teamId: keeperTeam, prospectId: keeperProspect })) setKeeperProspect(""); }}
                className={chip} style={{ borderColor: "var(--sh-border2)", color: "var(--sh-primary)" }}>Add keeper</button>
            </div>
          </section>

          <section className="rounded-xl border p-4 flex items-center justify-between gap-3 flex-wrap" style={card}>
            <span className="text-sm" style={{ color: "var(--sh-muted)" }}>
              {draft.prospectsTotal} prospects · {draft.teamsTotal} teams · ~{Math.max(1, Math.floor(draft.prospectsTotal / Math.max(1, draft.teamsTotal)))} per team
            </span>
            <button onClick={() => act("/start")} disabled={draft.pickOrder.length === 0}
              className="text-sm px-4 py-2 rounded-md font-semibold disabled:opacity-50" style={{ background: "var(--sh-primary)", color: "#04120a" }}>Start draft →</button>
          </section>
        </>
      )}

      {/* ── LIVE ── */}
      {status === "LIVE" && (
        <>
          <section className="rounded-2xl border p-5 text-center" style={card}>
            <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--sh-muted)" }}>On the clock</p>
            <p className="text-2xl font-black" style={{ color: "var(--sh-primary)" }}>{draft.onClock?.name ?? "—"}</p>
            {draft.next && <p className="text-xs mt-1" style={{ color: "var(--sh-muted)" }}>Next: {draft.next.name}</p>}
            <p className="text-xs mt-2" style={{ color: "var(--sh-muted)" }}>Pick {draft.picksMade + 1} · {available.length} left</p>
            <div className="flex items-center justify-center gap-2 mt-3">
              <button onClick={() => act("/undo")} className={chip} style={{ borderColor: "var(--sh-border2)", color: "var(--sh-secondary)" }}>↩ Undo</button>
              <button onClick={() => { if (confirm("End the draft?")) act("/finish"); }} className={chip} style={{ borderColor: "#7f1d1d", color: "#f87171" }}>End draft</button>
            </div>
          </section>

          <section className="rounded-xl border p-4" style={card}>
            <h2 className="font-bold mb-2" style={{ color: "var(--sh-text)" }}>Available — tap to draft to {draft.onClock?.name ?? "the team"}</h2>
            {available.length === 0 ? <p className="text-sm" style={{ color: "var(--sh-muted)" }}>All prospects drafted. End the draft.</p> : (
              <div className="space-y-3">
                {tiers.map((tier, ti) => {
                  const inTier = available.filter((p) => p.tier === ti);
                  if (!inTier.length) return null;
                  return (
                    <div key={ti}>
                      <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "var(--sh-primary)" }}>{tier.label}</p>
                      <div className="flex flex-wrap gap-2">
                        {inTier.map((p) => (
                          <button key={p.id} onClick={() => act("/pick", { prospectId: p.id })} disabled={!draft.onClock}
                            className="text-sm px-3 py-1.5 rounded-lg border transition-colors" style={{ borderColor: "var(--sh-border2)", color: "var(--sh-text)", background: "var(--sh-bg-card2)" }}>
                            {p.name} <span style={{ color: "var(--sh-muted)" }}>{p.score ?? "—"}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {(() => {
                  const unrated = available.filter((p) => p.tier >= tiers.length);
                  if (!unrated.length) return null;
                  return (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "var(--sh-muted)" }}>Unrated</p>
                      <div className="flex flex-wrap gap-2">
                        {unrated.map((p) => (
                          <button key={p.id} onClick={() => act("/pick", { prospectId: p.id })} disabled={!draft.onClock}
                            className="text-sm px-3 py-1.5 rounded-lg border" style={{ borderColor: "var(--sh-border2)", color: "var(--sh-text)", background: "var(--sh-bg-card2)" }}>{p.name}</button>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </section>
          <Rosters rosters={rosters} onClockId={draft.onClock?.id} />
        </>
      )}

      {/* ── DONE ── */}
      {status === "DONE" && (
        <>
          <p className="text-sm px-3 py-2 rounded-lg" style={{ background: "rgba(96,165,250,.12)", color: "#60a5fa" }}>Draft complete — {draft.picksMade} players drafted. Rosters are final.</p>
          <Rosters rosters={rosters} />
        </>
      )}
    </div>
  );
}

function Rosters({ rosters, onClockId }: { rosters: Board["rosters"]; onClockId?: string }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2">
      {rosters.map((r) => (
        <div key={r.id} className="rounded-xl border p-4" style={{ borderColor: r.id === onClockId ? "var(--sh-primary)" : "var(--sh-border)", background: "var(--sh-bg-card)" }}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold" style={{ color: "var(--sh-text)" }}>{r.name}</h3>
            <span className="text-xs" style={{ color: "var(--sh-muted)" }}>{r.players.length}</span>
          </div>
          <ol className="space-y-1">
            {r.players.map((p) => (
              <li key={p.prospectId} className="flex items-center justify-between text-sm">
                <span style={{ color: "var(--sh-text)" }}>{p.name}{p.isKeeper && <span className="ml-1 text-xs" style={{ color: "var(--sh-primary)" }}>· keeper</span>}</span>
                <span className="text-xs" style={{ color: "var(--sh-muted)" }}>{p.score ?? ""}</span>
              </li>
            ))}
            {r.players.length === 0 && <li className="text-sm" style={{ color: "var(--sh-muted)" }}>—</li>}
          </ol>
        </div>
      ))}
    </section>
  );
}
