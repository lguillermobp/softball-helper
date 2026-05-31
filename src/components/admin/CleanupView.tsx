"use client";

import { useState, useEffect } from "react";

interface InactiveUser {
  id: string;
  name: string | null;
  email: string;
  createdAt: string;
  emailVerified: boolean;
  leagueCount: number;
  playerCount: number;
  leagues: string[];
  teams: string[];
}

interface InactiveTeam {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  leagueName: string;
  playerCount: number;
  gameCount: number;
  canDelete: boolean;
}

const dim   = { color: "var(--sh-muted)" };
const head  = { color: "var(--sh-text)" };
const card  = { borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" };

type Step = "review" | "confirm" | "done";

export function CleanupView() {
  const [users,   setUsers]   = useState<InactiveUser[]>([]);
  const [teams,   setTeams]   = useState<InactiveTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  const [selUsers, setSelUsers] = useState<Set<string>>(new Set());
  const [selTeams, setSelTeams] = useState<Set<string>>(new Set());

  const [step,     setStep]    = useState<Step>("review");
  const [confirm,  setConfirm] = useState("");
  const [deleting, setDeleting]= useState(false);
  const [result,   setResult]  = useState<{ users: number; teams: number; errors: string[] } | null>(null);

  useEffect(() => {
    fetch("/api/admin/cleanup")
      .then((r) => r.json())
      .then((d) => { setUsers(d.users ?? []); setTeams(d.teams ?? []); })
      .catch(() => setError("Failed to load inactive records."))
      .finally(() => setLoading(false));
  }, []);

  function toggleUser(id: string) {
    setSelUsers((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleTeam(id: string) {
    setSelTeams((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAllUsers() {
    setSelUsers((prev) => prev.size === users.length ? new Set() : new Set(users.map((u) => u.id)));
  }
  function toggleAllTeams() {
    const deletable = teams.filter((t) => t.canDelete);
    setSelTeams((prev) => prev.size === deletable.length ? new Set() : new Set(deletable.map((t) => t.id)));
  }

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch("/api/admin/cleanup", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds: [...selUsers], teamIds: [...selTeams] }),
    });
    const data = await res.json();
    setDeleting(false);
    setResult(data);
    setStep("done");
    // Refresh the list
    fetch("/api/admin/cleanup")
      .then((r) => r.json())
      .then((d) => { setUsers(d.users ?? []); setTeams(d.teams ?? []); });
    setSelUsers(new Set());
    setSelTeams(new Set());
  }

  const totalSelected = selUsers.size + selTeams.size;
  const nothingToClean = users.length === 0 && teams.length === 0;

  if (loading) return <p className="text-sm py-10 text-center" style={dim}>Loading inactive records…</p>;
  if (error)   return <p className="text-sm py-10 text-center" style={{ color: "var(--sh-danger)" }}>{error}</p>;

  if (nothingToClean) return (
    <div className="rounded-2xl border py-16 text-center space-y-2" style={card}>
      <p className="text-2xl">✓</p>
      <p className="font-semibold" style={head}>Nothing to clean up</p>
      <p className="text-sm" style={dim}>No inactive users or teams found.</p>
    </div>
  );

  if (step === "done" && result) return (
    <div className="rounded-2xl border p-8 text-center space-y-3" style={card}>
      <p className="text-3xl">🗑️</p>
      <p className="text-xl font-bold" style={{ color: "var(--sh-primary)" }}>Cleanup complete</p>
      <p className="text-sm" style={dim}>
        {result.users} user{result.users !== 1 ? "s" : ""} and {result.teams} team{result.teams !== 1 ? "s" : ""} deleted.
      </p>
      {result.errors.length > 0 && (
        <div className="text-xs text-left rounded-xl border p-3 mt-2" style={{ borderColor: "var(--sh-danger-border)", color: "var(--sh-danger)" }}>
          {result.errors.map((e, i) => <p key={i}>{e}</p>)}
        </div>
      )}
      <button onClick={() => setStep("review")}
        className="text-sm px-4 py-2 rounded-lg border mt-2"
        style={{ borderColor: "var(--sh-border2)", color: "var(--sh-primary)", background: "transparent" }}>
        Back to review
      </button>
    </div>
  );

  if (step === "confirm") return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div className="rounded-2xl border p-6 space-y-4" style={{ ...card, borderColor: "var(--sh-danger-border)" }}>
        <h2 className="text-lg font-bold" style={{ color: "var(--sh-danger)" }}>⚠️ Confirm deletion</h2>

        <div className="space-y-1 text-sm" style={head}>
          {selUsers.size > 0 && (
            <p>• <strong>{selUsers.size}</strong> user{selUsers.size !== 1 ? "s" : ""} will be permanently deleted</p>
          )}
          {selTeams.size > 0 && (
            <p>• <strong>{selTeams.size}</strong> team{selTeams.size !== 1 ? "s" : ""} and all their players will be permanently deleted</p>
          )}
        </div>

        <p className="text-sm" style={dim}>
          This action <strong style={{ color: "var(--sh-danger)" }}>cannot be undone</strong>. Type <strong>DELETE</strong> to confirm.
        </p>

        <input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Type DELETE to confirm"
          className="w-full rounded-xl border px-4 py-2 text-sm outline-none"
          style={{ background: "var(--sh-bg-card2)", borderColor: confirm === "DELETE" ? "var(--sh-danger)" : "var(--sh-border)", color: "var(--sh-text)" }}
        />

        <div className="flex gap-3 justify-end">
          <button onClick={() => { setStep("review"); setConfirm(""); }}
            className="text-sm px-4 py-2 rounded-lg border"
            style={{ borderColor: "var(--sh-border2)", color: "var(--sh-secondary)", background: "transparent" }}>
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={confirm !== "DELETE" || deleting}
            className="text-sm px-4 py-2 rounded-lg font-semibold disabled:opacity-40"
            style={{ background: "var(--sh-danger)", color: "#fff" }}>
            {deleting ? "Deleting…" : `Delete ${totalSelected} record${totalSelected !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>
  );

  // ── Review step ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">

      {/* Inactive Users */}
      {users.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold" style={head}>
              👤 Inactive users <span className="text-sm font-normal" style={dim}>({users.length})</span>
            </h2>
            <button onClick={toggleAllUsers} className="text-xs hover:underline" style={{ color: "var(--sh-primary)" }}>
              {selUsers.size === users.length ? "Deselect all" : "Select all"}
            </button>
          </div>

          <div className="rounded-2xl border overflow-hidden" style={card}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--sh-border)", background: "var(--sh-bg-card2)" }}>
                  <th className="px-4 py-3 w-8" />
                  {["User", "Leagues", "Teams", "Joined"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={dim}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ borderBottom: "1px solid var(--sh-border)", background: selUsers.has(u.id) ? "var(--sh-danger-bg)" : "transparent" }}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selUsers.has(u.id)} onChange={() => toggleUser(u.id)}
                        className="accent-red-500 w-4 h-4" />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium" style={head}>{u.name ?? "—"}</p>
                      <p className="text-xs" style={dim}>{u.email}</p>
                      {!u.emailVerified && <span className="text-xs" style={{ color: "var(--sh-warn)" }}>Unverified</span>}
                    </td>
                    <td className="px-4 py-3 text-xs" style={dim}>
                      {u.leagues.length > 0 ? u.leagues.join(", ") : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs" style={dim}>
                      {u.teams.length > 0 ? u.teams.join(", ") : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs" style={dim}>
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Inactive Teams */}
      {teams.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold" style={head}>
              👥 Inactive teams <span className="text-sm font-normal" style={dim}>({teams.length})</span>
            </h2>
            <button onClick={toggleAllTeams} className="text-xs hover:underline" style={{ color: "var(--sh-primary)" }}>
              {selTeams.size === teams.filter((t) => t.canDelete).length ? "Deselect all" : "Select all deletable"}
            </button>
          </div>

          <div className="rounded-2xl border overflow-hidden" style={card}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--sh-border)", background: "var(--sh-bg-card2)" }}>
                  <th className="px-4 py-3 w-8" />
                  {["Team", "League", "Players", "Games", "Status"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={dim}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teams.map((t) => (
                  <tr key={t.id} style={{ borderBottom: "1px solid var(--sh-border)", background: selTeams.has(t.id) ? "var(--sh-danger-bg)" : "transparent", opacity: t.canDelete ? 1 : 0.55 }}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selTeams.has(t.id)} onChange={() => toggleTeam(t.id)}
                        disabled={!t.canDelete} className="accent-red-500 w-4 h-4 disabled:cursor-not-allowed" />
                    </td>
                    <td className="px-4 py-3 font-medium" style={head}>{t.name}</td>
                    <td className="px-4 py-3 text-xs" style={dim}>{t.leagueName}</td>
                    <td className="px-4 py-3 text-xs text-center" style={dim}>{t.playerCount}</td>
                    <td className="px-4 py-3 text-xs text-center">
                      {t.gameCount > 0
                        ? <span style={{ color: "var(--sh-warn)" }}>{t.gameCount} games</span>
                        : <span style={dim}>0</span>}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {t.canDelete
                        ? <span style={{ color: "var(--sh-primary)" }}>Can delete</span>
                        : <span style={{ color: "var(--sh-warn)" }}>Has games — skip</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs" style={dim}>
            Teams with games cannot be deleted to preserve historical records.
          </p>
        </section>
      )}

      {/* Action bar */}
      <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: "var(--sh-border)" }}>
        <p className="text-sm" style={dim}>
          {totalSelected === 0
            ? "Select records to delete"
            : `${totalSelected} record${totalSelected !== 1 ? "s" : ""} selected`}
        </p>
        <button
          onClick={() => setStep("confirm")}
          disabled={totalSelected === 0}
          className="px-5 py-2 rounded-xl font-semibold text-sm disabled:opacity-40"
          style={{ background: "var(--sh-danger)", color: "#fff" }}>
          Review & delete →
        </button>
      </div>
    </div>
  );
}
