"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Skill { id: string; name: string; order: number }
interface Evaluator { id: string; attendanceConfirmed: boolean; user: { id: string; name: string | null; email: string } }
interface Participant { id: string; sequenceOrder: number; attendanceConfirmed: boolean; prospect: { id: string; name: string } }
interface Tryout {
  id: string; name: string | null; scheduledAt: string | null; ratingMin: number; ratingMax: number;
  status: string; seasonId: string; categoryId: string;
  season: { name: string } | null; category: { name: string } | null; field: { id: string; name: string } | null;
  skills: Skill[]; evaluators: Evaluator[]; participants: Participant[];
}
interface Prospect { id: string; name: string }

const card = { borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" };
const chip = "text-xs px-2 py-1 rounded-md border";

export function TryoutSetupView({ slug, tryoutId }: { slug: string; tryoutId: string }) {
  const [t, setT] = useState<Tryout | null>(null);
  const [eligible, setEligible] = useState<Prospect[]>([]);
  const [skillName, setSkillName] = useState("");
  const [coachEmail, setCoachEmail] = useState("");
  const [err, setErr] = useState("");
  const router = useRouter();
  const base = `/api/leagues/${slug}/tryouts/${tryoutId}`;

  async function start(runMode: "BY_PLAYER" | "BY_SKILL") {
    if (await call(`${base}/start`, "POST", { runMode })) router.push(`/league/${slug}/tryout/${tryoutId}/run`);
  }

  const reload = useCallback(async () => {
    const res = await fetch(base);
    if (!res.ok) return;
    const { tryout } = await res.json();
    setT(tryout);
    if (tryout) {
      const pr = await fetch(`/api/leagues/${slug}/prospects?seasonId=${tryout.seasonId}&categoryId=${tryout.categoryId}`);
      const d = await pr.json().catch(() => ({ prospects: [] }));
      setEligible(pr.ok ? d.prospects : []);
    }
  }, [base, slug]);
  useEffect(() => { void reload(); }, [reload]);

  async function call(url: string, method: string, body?: unknown) {
    setErr("");
    const res = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : {}, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!res.ok) { setErr((await res.json().catch(() => ({}))).error ?? "Something went wrong"); return false; }
    await reload();
    return true;
  }

  if (!t) return <p style={{ color: "var(--sh-muted)" }}>Loading…</p>;

  const isSetup = t.status === "SETUP";
  const participantIds = new Set(t.participants.map((p) => p.prospect.id));
  const notYet = eligible.filter((p) => !participantIds.has(p.id));
  const ready = t.skills.length > 0 && t.evaluators.length > 0 && t.participants.length >= 2;

  async function move(idx: number, dir: -1 | 1) {
    const arr = [...t!.participants];
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    await call(`${base}/participants`, "PATCH", { order: arr.map((p) => p.id) });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black" style={{ color: "var(--sh-text)" }}>{t.name || `${t.category?.name} tryout`}</h1>
        <p className="text-sm" style={{ color: "var(--sh-muted)" }}>
          {t.season?.name} · {t.category?.name}
          {t.scheduledAt ? ` · ${new Date(t.scheduledAt).toLocaleString()}` : ""}
          {t.field?.name ? ` · ${t.field.name}` : ""} · ratings {t.ratingMin}–{t.ratingMax}
        </p>
      </div>

      {err && <p className="text-sm" style={{ color: "#f87171" }}>{err}</p>}
      {!isSetup && (
        <div className="flex items-center justify-between gap-3 flex-wrap px-3 py-2 rounded-lg" style={{ background: "rgba(74,222,128,.12)" }}>
          <span className="text-sm" style={{ color: "#4ade80" }}>This tryout has started — setup is locked.</span>
          <a href={`/league/${slug}/tryout/${tryoutId}/run`} className="text-sm px-3 py-1.5 rounded-md font-semibold" style={{ background: "var(--sh-primary)", color: "#04120a" }}>Go to run screen →</a>
        </div>
      )}

      {/* Skills */}
      <section className="rounded-xl border p-4" style={card}>
        <h2 className="font-bold mb-2" style={{ color: "var(--sh-text)" }}>Skills to assess</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          {t.skills.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-2 text-sm px-3 py-1 rounded-full" style={{ background: "var(--sh-bg-card2)", color: "var(--sh-text)" }}>
              {s.name}
              {isSetup && <button onClick={() => call(`${base}/skills/${s.id}`, "DELETE")} style={{ color: "#f87171" }}>✕</button>}
            </span>
          ))}
          {t.skills.length === 0 && <span className="text-sm" style={{ color: "var(--sh-muted)" }}>None yet.</span>}
        </div>
        {isSetup && (
          <div className="flex gap-2">
            <input value={skillName} onChange={(e) => setSkillName(e.target.value)} placeholder="Add a skill (e.g. Throwing)"
              className="flex-1 rounded-md border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-green-500"
              style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card2)", color: "var(--sh-text)" }} />
            <button onClick={async () => { if (await call(`${base}/skills`, "POST", { name: skillName })) setSkillName(""); }}
              className={chip} style={{ borderColor: "var(--sh-border2)", color: "var(--sh-primary)" }}>Add</button>
          </div>
        )}
      </section>

      {/* Evaluators */}
      <section className="rounded-xl border p-4" style={card}>
        <h2 className="font-bold mb-2" style={{ color: "var(--sh-text)" }}>Coaches / evaluators</h2>
        <ul className="space-y-1 mb-3">
          {t.evaluators.map((e) => (
            <li key={e.id} className="flex items-center justify-between text-sm">
              <span style={{ color: "var(--sh-text)" }}>{e.user.name ?? e.user.email} <span style={{ color: "var(--sh-muted)" }}>· {e.user.email}</span></span>
              {isSetup && <button onClick={() => call(`${base}/evaluators?userId=${e.user.id}`, "DELETE")} className={chip} style={{ borderColor: "#7f1d1d", color: "#f87171" }}>Remove</button>}
            </li>
          ))}
          {t.evaluators.length === 0 && <li className="text-sm" style={{ color: "var(--sh-muted)" }}>None yet.</li>}
        </ul>
        {isSetup && (
          <div className="flex gap-2">
            <input type="email" value={coachEmail} onChange={(e) => setCoachEmail(e.target.value)} placeholder="coach@email.com"
              className="flex-1 rounded-md border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-green-500"
              style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card2)", color: "var(--sh-text)" }} />
            <button onClick={async () => { if (await call(`${base}/evaluators`, "POST", { email: coachEmail })) setCoachEmail(""); }}
              className={chip} style={{ borderColor: "var(--sh-border2)", color: "var(--sh-primary)" }}>Add coach</button>
          </div>
        )}
      </section>

      {/* Participants + sequence */}
      <section className="rounded-xl border p-4" style={card}>
        <h2 className="font-bold mb-2" style={{ color: "var(--sh-text)" }}>Players &amp; evaluation order</h2>
        <ol className="space-y-1 mb-3">
          {t.participants.map((p, i) => (
            <li key={p.id} className="flex items-center justify-between gap-2 text-sm rounded-lg px-2 py-1" style={{ background: "var(--sh-bg-card2)" }}>
              <span style={{ color: "var(--sh-text)" }}><span className="font-mono" style={{ color: "var(--sh-muted)" }}>{i + 1}.</span> {p.prospect.name}</span>
              {isSetup && (
                <span className="flex items-center gap-1">
                  <button onClick={() => move(i, -1)} disabled={i === 0} className={chip} style={{ borderColor: "var(--sh-border2)", color: "var(--sh-secondary)", opacity: i === 0 ? 0.4 : 1 }}>↑</button>
                  <button onClick={() => move(i, 1)} disabled={i === t.participants.length - 1} className={chip} style={{ borderColor: "var(--sh-border2)", color: "var(--sh-secondary)", opacity: i === t.participants.length - 1 ? 0.4 : 1 }}>↓</button>
                  <button onClick={() => call(`${base}/participants?id=${p.id}`, "DELETE")} className={chip} style={{ borderColor: "#7f1d1d", color: "#f87171" }}>✕</button>
                </span>
              )}
            </li>
          ))}
          {t.participants.length === 0 && <li className="text-sm" style={{ color: "var(--sh-muted)" }}>No players added.</li>}
        </ol>
        {isSetup && notYet.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold" style={{ color: "var(--sh-muted)" }}>Add from registered prospects</p>
              <button onClick={() => call(`${base}/participants`, "POST", { prospectIds: notYet.map((p) => p.id) })}
                className={chip} style={{ borderColor: "var(--sh-border2)", color: "var(--sh-primary)" }}>Add all</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {notYet.map((p) => (
                <button key={p.id} onClick={() => call(`${base}/participants`, "POST", { prospectIds: [p.id] })}
                  className="text-sm px-3 py-1 rounded-full border" style={{ borderColor: "var(--sh-border2)", color: "var(--sh-text)" }}>+ {p.name}</button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Readiness + start */}
      {isSetup && (
        <section className="rounded-xl border p-4 flex items-center justify-between gap-3 flex-wrap" style={card}>
          <div className="text-sm" style={{ color: ready ? "var(--sh-primary)" : "var(--sh-muted)" }}>
            {ready ? "✓ Ready to run — choose how to run it:" : "Add at least 1 skill, 1 coach and 2 players to run this tryout."}
          </div>
          {ready && (
            <div className="flex items-center gap-2">
              <button onClick={() => start("BY_PLAYER")} className="text-sm px-4 py-2 rounded-md font-semibold border" style={{ borderColor: "var(--sh-primary)", color: "var(--sh-primary)", background: "transparent" }}>Start by player</button>
              <button onClick={() => start("BY_SKILL")} className="text-sm px-4 py-2 rounded-md font-semibold" style={{ background: "var(--sh-primary)", color: "#04120a" }}>Start by skill</button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
