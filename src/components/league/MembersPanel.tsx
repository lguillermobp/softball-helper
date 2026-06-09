"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";

interface Member {
  id: string; role: string;
  user: { id: string; name: string | null; email: string; phone: string | null; emailVerified: string | null };
}

const ROLES = [
  { value: "LEAGUE_ADMIN",  label: "League Admin" },
  { value: "UMPIRE",        label: "Umpire" },
  { value: "SCOREKEEPER",   label: "Scorekeeper" },
];

const ROLE_LABELS: Record<string, string> = {
  LEAGUE_ADMIN:          "League Admin",
  UMPIRE:                "Umpire",
  SCOREKEEPER:           "Scorekeeper",
  TEAM_MANAGER:          "Team Manager",
  TEAM_MANAGER_PLAYER:   "Manager / Player",
  TEAM_ASSISTANT:        "Team Assistant",
  TEAM_ASSISTANT_PLAYER: "Assistant / Player",
};

function roleLabel(r: string) {
  return ROLE_LABELS[r] ?? r.replace(/_/g, " ").toLowerCase();
}

const PAGE_SIZE = 15;

interface Props { slug: string; members: Member[] }

export function MembersPanel({ slug, members }: Props) {
  const router = useRouter();

  // ── Search + pagination ────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [page, setPage]     = useState(1);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return members;
    return members.filter(m =>
      (m.user.name ?? "").toLowerCase().includes(q) ||
      m.user.email.toLowerCase().includes(q) ||
      roleLabel(m.role).toLowerCase().includes(q)
    );
  }, [members, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const pageItems  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function handleSearch(v: string) { setSearch(v); setPage(1); }

  // ── Add member ──────────────────────────────────────────────────────────────
  const [adding,   setAdding]   = useState(false);
  const [addName,  setAddName]  = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addRole,  setAddRole]  = useState("LEAGUE_ADMIN");
  const [addLoading, setAddLoading] = useState(false);
  const [addError,   setAddError]   = useState("");

  function resetAdd() { setAdding(false); setAddName(""); setAddEmail(""); setAddRole("LEAGUE_ADMIN"); setAddError(""); }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!addEmail || !addRole) { setAddError("Email and role are required."); return; }
    setAddLoading(true);
    setAddError("");
    try {
      const res = await fetch(`/api/leagues/${slug}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: addName.trim() || undefined, email: addEmail.trim(), role: addRole }),
      });
      const data = await res.json();
      if (!res.ok) { setAddError(data.error ?? "Something went wrong"); return; }
      resetAdd();
      router.refresh();
    } finally {
      setAddLoading(false);
    }
  }

  // ── Edit role ───────────────────────────────────────────────────────────────
  const [editingId,   setEditingId]   = useState<string | null>(null);
  const [editRole,    setEditRole]    = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError,   setEditError]   = useState("");

  function startEdit(m: Member) { setEditingId(m.id); setEditRole(m.role); setEditError(""); }
  function cancelEdit() { setEditingId(null); setEditError(""); }

  async function handleEditSave(memberId: string) {
    setEditLoading(true);
    setEditError("");
    try {
      const res = await fetch(`/api/leagues/${slug}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: editRole }),
      });
      const data = await res.json();
      if (!res.ok) { setEditError(data.error ?? "Something went wrong"); return; }
      setEditingId(null);
      router.refresh();
    } finally {
      setEditLoading(false);
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  const [deletingId,  setDeletingId]  = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<Record<string, string>>({});

  async function handleDelete(memberId: string) {
    const res = await fetch(`/api/leagues/${slug}/members/${memberId}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json();
      setDeleteError(prev => ({ ...prev, [memberId]: d.error ?? "Cannot remove" }));
    } else {
      setDeletingId(null);
      router.refresh();
    }
  }

  // ── Styles ─────────────────────────────────────────────────────────────────
  const inputCls = "w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500";
  const inputSty = { borderColor: "var(--sh-border)", background: "var(--sh-bg-card2)", color: "var(--sh-text)" } as const;
  const btnSm    = "text-xs px-2.5 py-1.5 rounded-lg border transition-colors hover:opacity-80 disabled:opacity-50";

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-bold" style={{ color: "var(--sh-text)" }}>
          Members
          <span className="ml-2 text-sm font-normal" style={{ color: "var(--sh-muted)" }}>({members.length})</span>
        </h2>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="text-sm px-4 py-2 rounded-xl font-semibold transition-colors"
            style={{ background: "linear-gradient(135deg,#16a34a,#15803d)", color: "#fff" }}
          >
            + Add member
          </button>
        )}
      </div>

      {/* Inline add form */}
      {adding && (
        <form onSubmit={handleAdd}
          className="rounded-2xl border p-4 space-y-3"
          style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card2)" }}
        >
          <p className="text-sm font-semibold" style={{ color: "var(--sh-primary)" }}>New member</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: "var(--sh-muted)" }}>Full name</label>
              <input
                className={inputCls} style={inputSty}
                placeholder="Jane Smith"
                value={addName} onChange={e => setAddName(e.target.value)}
              />
              <p className="text-xs" style={{ color: "var(--sh-muted)" }}>Required if no account yet</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: "var(--sh-muted)" }}>Email *</label>
              <input
                type="email" required
                className={inputCls} style={inputSty}
                placeholder="user@example.com"
                value={addEmail} onChange={e => setAddEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: "var(--sh-muted)" }}>Role *</label>
              <select
                required className={inputCls} style={inputSty}
                value={addRole} onChange={e => setAddRole(e.target.value)}
              >
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
          </div>
          {addError && <p className="text-sm" style={{ color: "#f87171" }}>{addError}</p>}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={resetAdd}
              className={btnSm}
              style={{ borderColor: "var(--sh-border2)", color: "var(--sh-muted)", background: "transparent" }}>
              Cancel
            </button>
            <button type="submit" disabled={addLoading}
              className={btnSm}
              style={{ background: "linear-gradient(135deg,#16a34a,#15803d)", color: "#fff", border: "none" }}>
              {addLoading ? "Adding…" : "Add member"}
            </button>
          </div>
        </form>
      )}

      {/* Search */}
      <input
        type="search"
        placeholder="Search by name, email or role…"
        value={search} onChange={e => handleSearch(e.target.value)}
        className={inputCls} style={inputSty}
      />

      {/* Table */}
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" }}>
        {pageItems.length === 0 ? (
          <p className="px-4 py-6 text-sm text-center" style={{ color: "var(--sh-muted)" }}>
            {search ? "No members match your search." : "No members yet."}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--sh-border)" }}>
                {["Name", "Email", "Role", "Verified", ""].map((h, i) => (
                  <th key={i}
                    className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider${i === 1 ? " hidden sm:table-cell" : ""}`}
                    style={{ color: "var(--sh-muted)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageItems.map(m => (
                <tr key={m.id} style={{ borderBottom: "1px solid var(--sh-border-subtle, #0f2310)" }}>
                  {/* Name */}
                  <td className="px-4 py-3 font-medium" style={{ color: "var(--sh-text)" }}>
                    <div>{m.user.name ?? "—"}</div>
                    <div className="text-xs sm:hidden" style={{ color: "var(--sh-muted)" }}>{m.user.email}</div>
                  </td>
                  {/* Email */}
                  <td className="px-4 py-3 hidden sm:table-cell" style={{ color: "var(--sh-muted)" }}>{m.user.email}</td>
                  {/* Role (editable inline) */}
                  <td className="px-4 py-3">
                    {editingId === m.id ? (
                      <select
                        value={editRole} onChange={e => setEditRole(e.target.value)}
                        className="rounded-md border px-2 py-1 text-xs focus:outline-none"
                        style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card2)", color: "var(--sh-text)" }}
                      >
                        {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    ) : (
                      <span className="text-xs font-semibold rounded-full px-2.5 py-0.5" style={{ background: "#1a3d1a", color: "#4ade80" }}>
                        {roleLabel(m.role)}
                      </span>
                    )}
                  </td>
                  {/* Verified */}
                  <td className="px-4 py-3">
                    {m.user.emailVerified
                      ? <span className="text-xs font-semibold" style={{ color: "var(--sh-muted)" }}>✓ Verified</span>
                      : <span className="text-xs" style={{ color: "#fbbf24" }}>Pending</span>}
                  </td>
                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {editingId === m.id ? (
                        <>
                          <button onClick={() => handleEditSave(m.id)} disabled={editLoading}
                            className={btnSm}
                            style={{ background: "linear-gradient(135deg,#16a34a,#15803d)", color: "#fff", border: "none" }}>
                            {editLoading ? "Saving…" : "Save"}
                          </button>
                          <button onClick={cancelEdit} className={btnSm}
                            style={{ borderColor: "var(--sh-border2)", color: "var(--sh-muted)", background: "transparent" }}>
                            ✕
                          </button>
                          {editError && <p className="text-xs w-full" style={{ color: "#f87171" }}>{editError}</p>}
                        </>
                      ) : deletingId === m.id ? (
                        <>
                          <button onClick={() => handleDelete(m.id)}
                            className={btnSm}
                            style={{ borderColor: "#7f1d1d", color: "#f87171", background: "transparent" }}>
                            Confirm
                          </button>
                          <button onClick={() => setDeletingId(null)} className={btnSm}
                            style={{ borderColor: "var(--sh-border2)", color: "var(--sh-muted)", background: "transparent" }}>
                            ✕
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(m)} className={btnSm}
                            style={{ borderColor: "var(--sh-border2)", color: "var(--sh-primary)", background: "transparent" }}>
                            Edit
                          </button>
                          <button onClick={() => { setDeleteError({}); setDeletingId(m.id); }} className={btnSm}
                            style={{ borderColor: "var(--sh-border2)", color: "#f87171", background: "transparent" }}>
                            Remove
                          </button>
                        </>
                      )}
                      {deleteError[m.id] && (
                        <p className="text-xs w-full" style={{ color: "#f87171" }}>{deleteError[m.id]}</p>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs" style={{ color: "var(--sh-muted)" }}>
          <span>
            {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className={btnSm}
              style={{ borderColor: "var(--sh-border2)", color: "var(--sh-muted)", background: "transparent" }}>
              ← Prev
            </button>
            <span className="px-3 py-1.5 rounded-lg border text-xs"
              style={{ borderColor: "var(--sh-border2)", color: "var(--sh-text)" }}>
              {safePage} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className={btnSm}
              style={{ borderColor: "var(--sh-border2)", color: "var(--sh-muted)", background: "transparent" }}>
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
