"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface Live {
  status: string; runMode: string | null; name: string | null; ratingMin: number; ratingMax: number; isAdmin: boolean;
  current: { participantId: string; participantName: string; skillId: string; skillName: string; position: number; total: number } | null;
  next: { participantName: string; skillName: string } | null;
  tally: { scored: number; present: number; total: number };
  me: { isEvaluator: boolean; attendanceConfirmed: boolean; rating: number | null; note: string | null };
  participants?: { id: string; name: string; attendanceConfirmed: boolean }[];
  evaluators?: { userId: string; name: string; attendanceConfirmed: boolean }[];
}
interface ResultRow { prospectId: string; name: string; overall: number | null; perSkill: Record<string, number | null> }

const card = { borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" };
const chip = "text-xs px-2.5 py-1 rounded-md border";

export function TryoutRunView({ slug, tryoutId }: { slug: string; tryoutId: string }) {
  const base = `/api/leagues/${slug}/tryouts/${tryoutId}`;
  const [live, setLive] = useState<Live | null>(null);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [results, setResults] = useState<{ skills: string[]; results: ResultRow[] } | null>(null);
  const cellKey = useRef<string>("");

  const load = useCallback(async () => {
    const res = await fetch(`${base}/live`);
    if (!res.ok) return;
    const d: Live = await res.json();
    // reset the note when the active cell changes
    const key = d.current ? `${d.current.participantId}:${d.current.skillId}` : "";
    if (key !== cellKey.current) { cellKey.current = key; setNote(d.me.note ?? ""); }
    setLive(d);
  }, [base]);

  useEffect(() => {
    void load();
    const id = setInterval(() => { void load(); }, 1500);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (live?.status === "DONE" && live.isAdmin && !results) {
      fetch(`${base}/results`).then((r) => r.ok && r.json()).then((d) => d && setResults(d));
    }
  }, [live?.status, live?.isAdmin, results, base]);

  async function post(path: string, body?: unknown) {
    setErr("");
    const res = await fetch(`${base}${path}`, { method: "POST", headers: body ? { "Content-Type": "application/json" } : {}, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!res.ok) { setErr((await res.json().catch(() => ({}))).error ?? "Something went wrong"); return false; }
    await load();
    return true;
  }

  if (!live) return <p style={{ color: "var(--sh-muted)" }}>Loading…</p>;

  const { me, current, next, tally, isAdmin, status } = live;
  const scale = Array.from({ length: live.ratingMax - live.ratingMin + 1 }, (_, i) => live.ratingMin + i);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-black" style={{ color: "var(--sh-text)" }}>{live.name || "Tryout"}</h1>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{
          background: status === "LIVE" ? "rgba(74,222,128,.14)" : status === "DONE" ? "rgba(96,165,250,.14)" : "var(--sh-bg-card2)",
          color: status === "LIVE" ? "#4ade80" : status === "DONE" ? "#60a5fa" : "var(--sh-muted)",
        }}>{status === "LIVE" ? `Live · ${live.runMode === "BY_SKILL" ? "by skill" : "by player"}` : status === "DONE" ? "Finished" : "Setup"}</span>
      </div>

      {err && <p className="text-sm" style={{ color: "#f87171" }}>{err}</p>}

      {/* Coach attendance gate */}
      {me.isEvaluator && !me.attendanceConfirmed && status !== "DONE" && (
        <div className="rounded-xl border p-4 flex items-center justify-between gap-3" style={card}>
          <span className="text-sm" style={{ color: "var(--sh-text)" }}>Confirm you&apos;re here to start scoring.</span>
          <button onClick={() => post("/attend", { present: true })} className="text-sm px-4 py-2 rounded-md font-semibold" style={{ background: "var(--sh-primary)", color: "#04120a" }}>I&apos;m here</button>
        </div>
      )}

      {status === "DONE" ? (
        <div className="rounded-xl border p-4" style={card}>
          <h2 className="font-bold mb-2" style={{ color: "var(--sh-text)" }}>Ranked results</h2>
          {!isAdmin ? (
            <p className="text-sm" style={{ color: "var(--sh-muted)" }}>This tryout is finished.</p>
          ) : !results ? (
            <p className="text-sm" style={{ color: "var(--sh-muted)" }}>Loading…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ color: "var(--sh-muted)", borderBottom: "1px solid var(--sh-border)" }}>
                    <th className="text-left px-2 py-1.5">#</th><th className="text-left px-2 py-1.5">Prospect</th>
                    <th className="text-left px-2 py-1.5">Overall</th>
                    {results.skills.map((s) => <th key={s} className="text-left px-2 py-1.5">{s}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {results.results.map((r, i) => (
                    <tr key={r.prospectId} style={{ borderBottom: "1px solid var(--sh-border)" }}>
                      <td className="px-2 py-1.5" style={{ color: "var(--sh-muted)" }}>{i + 1}</td>
                      <td className="px-2 py-1.5 font-medium" style={{ color: "var(--sh-text)" }}>{r.name}</td>
                      <td className="px-2 py-1.5 font-bold" style={{ color: "var(--sh-primary)" }}>{r.overall ?? "—"}</td>
                      {results.skills.map((s) => <td key={s} className="px-2 py-1.5" style={{ color: "var(--sh-secondary)" }}>{r.perSkill[s] ?? "—"}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Current + next */}
          <div className="rounded-2xl border p-6 text-center" style={card}>
            {current ? (
              <>
                <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--sh-muted)" }}>Now</p>
                <p className="text-2xl font-black" style={{ color: "var(--sh-text)" }}>{current.participantName}</p>
                <p className="text-lg font-semibold" style={{ color: "var(--sh-primary)" }}>{current.skillName}</p>
                <p className="text-xs mt-2" style={{ color: "var(--sh-muted)" }}>{current.position} of {current.total}</p>
                {next && <p className="text-xs mt-3" style={{ color: "var(--sh-muted)" }}>Next: {next.participantName} · {next.skillName}</p>}
              </>
            ) : (
              <p style={{ color: "var(--sh-muted)" }}>{status === "SETUP" ? "Not started yet." : "No active player."}</p>
            )}
          </div>

          {/* Coach scoring */}
          {me.isEvaluator && me.attendanceConfirmed && current && (
            <div className="rounded-xl border p-4" style={card}>
              <p className="text-sm font-semibold mb-2" style={{ color: "var(--sh-text)" }}>Your rating</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {scale.map((n) => (
                  <button key={n} onClick={() => post("/score", { rating: n, note })}
                    className="w-11 h-11 rounded-lg font-bold text-lg border transition-colors"
                    style={me.rating === n
                      ? { background: "var(--sh-primary)", color: "#04120a", borderColor: "var(--sh-primary)" }
                      : { borderColor: "var(--sh-border2)", color: "var(--sh-text)", background: "var(--sh-bg-card2)" }}>{n}</button>
                ))}
              </div>
              <input value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => me.rating != null && post("/score", { rating: me.rating, note })}
                placeholder="Optional note" className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500"
                style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card2)", color: "var(--sh-text)" }} />
              {me.rating != null && <p className="text-xs mt-1" style={{ color: "var(--sh-primary)" }}>✓ Scored {me.rating}</p>}
            </div>
          )}

          {/* Admin controls */}
          {isAdmin && (
            <div className="rounded-xl border p-4 space-y-4" style={card}>
              {status === "LIVE" && current && (
                <>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <span className="text-sm font-semibold" style={{ color: tally.scored >= tally.present && tally.present > 0 ? "var(--sh-primary)" : "var(--sh-text)" }}>
                      {tally.scored} / {tally.present} coaches in
                    </span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => post("/advance", { dir: -1 })} className={chip} style={{ borderColor: "var(--sh-border2)", color: "var(--sh-secondary)" }}>← Back</button>
                      <button onClick={() => post("/advance", { dir: 1 })} className="text-sm px-4 py-1.5 rounded-md font-semibold" style={{ background: "var(--sh-primary)", color: "#04120a" }}>Next →</button>
                    </div>
                  </div>
                  <button onClick={() => { if (confirm("End the tryout and lock scoring?")) post("/finish"); }} className={chip} style={{ borderColor: "#7f1d1d", color: "#f87171" }}>End tryout</button>
                </>
              )}

              {/* Attendance */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold mb-1" style={{ color: "var(--sh-muted)" }}>Players present</p>
                  <ul className="space-y-1">
                    {live.participants?.map((p) => (
                      <li key={p.id} className="flex items-center justify-between text-sm">
                        <span style={{ color: p.attendanceConfirmed ? "var(--sh-text)" : "var(--sh-muted)" }}>{p.name}</span>
                        <button onClick={() => post("/attendance", { participantId: p.id, present: !p.attendanceConfirmed })} className={chip}
                          style={p.attendanceConfirmed ? { borderColor: "var(--sh-primary)", color: "var(--sh-primary)" } : { borderColor: "var(--sh-border2)", color: "var(--sh-muted)" }}>
                          {p.attendanceConfirmed ? "Present" : "Absent"}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold mb-1" style={{ color: "var(--sh-muted)" }}>Coaches</p>
                  <ul className="space-y-1">
                    {live.evaluators?.map((e) => (
                      <li key={e.userId} className="flex items-center justify-between text-sm">
                        <span style={{ color: "var(--sh-text)" }}>{e.name}</span>
                        <span className="text-xs" style={{ color: e.attendanceConfirmed ? "var(--sh-primary)" : "var(--sh-muted)" }}>{e.attendanceConfirmed ? "here" : "—"}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
