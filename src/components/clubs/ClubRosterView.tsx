"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface PlayerRow { id: string; name: string; team: { name: string; league: { name: string } } }
interface Profile { id: string; name: string; dob: string | null; emails: string[]; players: PlayerRow[] }
interface Side { id: string; name: string; dob: string | null; leagues: string[]; teamCount: number }
interface Suggestion { a: Side; b: Side }
interface MergeRow { id: string; mergedName: string; createdAt: string }
interface Data { club: { id: string; name: string }; profiles: Profile[]; suggestions: Suggestion[]; unlinked: number; merges: MergeRow[] }

const card = { borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" } as const;
const fmtDob = (d: string | null) => (d ? new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "no DOB");

export function ClubRosterView({ clubId }: { clubId: string }) {
  const [d, setD] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const base = `/api/clubs/${clubId}`;

  const load = useCallback(async () => {
    const res = await fetch(`${base}/roster`);
    const j = await res.json().catch(() => null);
    if (res.ok) setD(j); else setErr(j?.error ?? "Failed to load roster");
    setLoading(false);
  }, [base]);
  useEffect(() => { void load(); }, [load]);

  async function act(url: string, method: string, body?: unknown) {
    setBusy(true); setErr("");
    const res = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : {}, ...(body ? { body: JSON.stringify(body) } : {}) });
    setBusy(false);
    if (!res.ok) { setErr((await res.json().catch(() => ({}))).error ?? "Something went wrong"); return; }
    await load();
  }

  const rebuild = () => act(`${base}/roster/rebuild`, "POST");
  const merge = (survivorId: string, mergedId: string) => act(`${base}/profiles`, "POST", { action: "merge", survivorId, mergedId });
  const keepSeparate = (aId: string, bId: string) => act(`${base}/profiles`, "POST", { action: "keep-separate", aId, bId });
  const unmerge = (mergeId: string) => act(`${base}/profiles`, "POST", { action: "unmerge", mergeId });

  return (
    <div className="min-h-screen" style={{ background: "var(--sh-bg)" }}>
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        <div>
          <Link href="/clubs" className="text-sm" style={{ color: "var(--sh-primary)" }}>← Clubs</Link>
          <h1 className="text-2xl font-black mt-1" style={{ color: "var(--sh-text)" }}>
            {d?.club.name ?? "Club"} · Master roster
          </h1>
          <p className="text-sm" style={{ color: "var(--sh-muted)" }}>
            One profile per person, built from this club&apos;s players across leagues. Merges only affect this club&apos;s view.
          </p>
        </div>

        {err && <p className="text-sm" style={{ color: "#f87171" }}>{err}</p>}
        {loading ? <p className="text-sm" style={{ color: "var(--sh-muted)" }}>Loading…</p> : d && (
          <>
            {/* Build / refresh */}
            <section className="rounded-xl border p-4 flex items-center justify-between gap-3 flex-wrap" style={card}>
              <div className="text-sm" style={{ color: d.unlinked > 0 ? "var(--sh-secondary)" : "var(--sh-muted)" }}>
                {d.profiles.length} profile{d.profiles.length !== 1 ? "s" : ""}
                {d.unlinked > 0 ? ` · ${d.unlinked} player${d.unlinked !== 1 ? "s" : ""} not yet in the roster` : " · all players linked"}
              </div>
              <button onClick={rebuild} disabled={busy}
                className="text-sm px-4 py-2 rounded-md font-semibold disabled:opacity-50"
                style={{ background: "var(--sh-primary)", color: "#04120a" }}>
                {busy ? "Working…" : d.unlinked > 0 ? "Build / refresh roster" : "Refresh"}
              </button>
            </section>

            {/* Suggested duplicates */}
            {d.suggestions.length > 0 && (
              <section className="rounded-xl border p-4 space-y-3" style={card}>
                <h2 className="font-bold" style={{ color: "var(--sh-text)" }}>Possible duplicates ({d.suggestions.length})</h2>
                {d.suggestions.map((s, i) => (
                  <div key={i} className="rounded-lg p-3 space-y-2" style={{ background: "var(--sh-bg-card2)" }}>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {[s.a, s.b].map((side) => (
                        <div key={side.id}>
                          <p className="font-semibold" style={{ color: "var(--sh-text)" }}>{side.name}</p>
                          <p className="text-xs" style={{ color: "var(--sh-muted)" }}>
                            {fmtDob(side.dob)} · {side.teamCount} team{side.teamCount !== 1 ? "s" : ""}
                            {side.leagues.length ? ` · ${side.leagues.join(", ")}` : ""}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button onClick={() => merge(s.a.id, s.b.id)} disabled={busy}
                        className="text-xs px-3 py-1.5 rounded-md font-semibold" style={{ background: "var(--sh-primary)", color: "#04120a" }}>
                        Merge → keep {s.a.name.split(" ")[0]} (A)
                      </button>
                      <button onClick={() => merge(s.b.id, s.a.id)} disabled={busy}
                        className="text-xs px-3 py-1.5 rounded-md font-semibold border" style={{ borderColor: "var(--sh-border2)", color: "var(--sh-primary)", background: "transparent" }}>
                        Merge → keep {s.b.name.split(" ")[0]} (B)
                      </button>
                      <button onClick={() => keepSeparate(s.a.id, s.b.id)} disabled={busy}
                        className="text-xs px-3 py-1.5 rounded-md border" style={{ borderColor: "var(--sh-border2)", color: "var(--sh-muted)", background: "transparent" }}>
                        Keep separate
                      </button>
                    </div>
                  </div>
                ))}
              </section>
            )}

            {/* Recently merged */}
            {d.merges.length > 0 && (
              <section className="rounded-xl border p-4 space-y-2" style={card}>
                <h2 className="font-bold" style={{ color: "var(--sh-text)" }}>Recent merges</h2>
                {d.merges.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-2 text-sm">
                    <span style={{ color: "var(--sh-secondary)" }}>Merged <b style={{ color: "var(--sh-text)" }}>{m.mergedName}</b></span>
                    <button onClick={() => unmerge(m.id)} disabled={busy}
                      className="text-xs px-2 py-1 rounded-md border" style={{ borderColor: "var(--sh-border2)", color: "var(--sh-primary)", background: "transparent" }}>
                      Undo
                    </button>
                  </div>
                ))}
              </section>
            )}

            {/* Profiles */}
            <section className="space-y-2">
              <h2 className="text-lg font-bold" style={{ color: "var(--sh-text)" }}>Profiles</h2>
              {d.profiles.length === 0 ? (
                <div className="rounded-2xl border py-10 text-center text-sm" style={{ borderColor: "var(--sh-border)", color: "var(--sh-muted)" }}>
                  No profiles yet. Attach teams to this club, then build the roster.
                </div>
              ) : d.profiles.map((p) => (
                <div key={p.id} className="rounded-xl border p-3" style={card}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-semibold" style={{ color: "var(--sh-text)" }}>{p.name}</span>
                    <span className="text-xs" style={{ color: "var(--sh-muted)" }}>{fmtDob(p.dob)}</span>
                  </div>
                  {p.emails.length > 0 && <p className="text-xs mt-0.5" style={{ color: "var(--sh-muted)" }}>{p.emails.join(" · ")}</p>}
                  <ul className="mt-2 space-y-1">
                    {p.players.map((pl) => (
                      <li key={pl.id} className="text-xs" style={{ color: "var(--sh-secondary)" }}>
                        {pl.team.name} <span style={{ color: "var(--sh-muted)" }}>· {pl.team.league.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
