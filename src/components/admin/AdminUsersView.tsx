"use client";

import { useState, useEffect, useCallback } from "react";
import { EditUserDialog } from "./EditUserDialog";
import { SetPasswordDialog } from "./SetPasswordDialog";

interface AdminUser {
  id: string; name: string | null; email: string; phone: string | null;
  emailVerified: string | null; isMasterAdmin: boolean; isActive: boolean;
  createdAt: string; _count: { leagueRoles: number };
}

const dim  = { color: "var(--sh-muted)" };
const head = { color: "var(--sh-text)" };
const card = { borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" };

export function AdminUsersView() {
  const [users,   setUsers]   = useState<AdminUser[]>([]);
  const [query,   setQuery]   = useState("");
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    const res = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setUsers(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(""); }, [load]);

  useEffect(() => {
    const id = setTimeout(() => load(query), 300);
    return () => clearTimeout(id);
  }, [query, load]);

  async function toggleActive(user: AdminUser) {
    setToggling(user.id);
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !user.isActive }),
    });
    if (res.ok) {
      const updated: AdminUser = await res.json();
      setUsers((prev) => prev.map((u) => u.id === user.id ? updated : u));
    }
    setToggling(null);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email…"
          className="flex-1 rounded-xl border px-4 py-2 text-sm outline-none"
          style={{ background: "var(--sh-bg-card2)", borderColor: "var(--sh-border)", color: "var(--sh-text)" }}
        />
        <span className="text-xs shrink-0" style={dim}>{users.length} users</span>
      </div>

      <div className="rounded-2xl border overflow-hidden" style={card}>
        {loading ? (
          <p className="px-6 py-8 text-sm text-center" style={dim}>Loading…</p>
        ) : users.length === 0 ? (
          <p className="px-6 py-8 text-sm text-center" style={dim}>No users found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--sh-border)" }}>
                  {["User", "Phone", "Leagues", "Status", "Verified", "Joined", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={dim}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="transition-colors" style={{ borderBottom: "1px solid var(--sh-border)", opacity: user.isActive ? 1 : 0.6 }}>
                    {/* User */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                          style={{ background: "var(--sh-bg-card2)", color: "var(--sh-primary)", border: "1px solid var(--sh-border2)" }}>
                          {(user.name ?? user.email).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium" style={head}>{user.name ?? "—"}</p>
                          <p className="text-xs" style={dim}>{user.email}</p>
                        </div>
                        {user.isMasterAdmin && (
                          <span className="text-xs font-bold rounded-full px-2 py-0.5 border ml-1"
                            style={{ background: "var(--sh-purple-bg)", color: "var(--sh-purple)", borderColor: "var(--sh-purple-border)" }}>
                            ★
                          </span>
                        )}
                      </div>
                    </td>
                    {/* Phone */}
                    <td className="px-4 py-3 text-xs" style={dim}>{user.phone ?? "—"}</td>
                    {/* Leagues */}
                    <td className="px-4 py-3 text-center text-xs font-semibold" style={{ color: "var(--sh-secondary)" }}>
                      {user._count.leagueRoles}
                    </td>
                    {/* Active status */}
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold rounded-full px-2.5 py-0.5"
                        style={user.isActive
                          ? { background: "var(--sh-approved-bg)", color: "var(--sh-primary)" }
                          : { background: "var(--sh-inactive-bg)", color: "var(--sh-inactive)" }}>
                        {user.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    {/* Email verified */}
                    <td className="px-4 py-3 text-xs font-semibold"
                      style={{ color: user.emailVerified ? "var(--sh-primary)" : "var(--sh-inactive)" }}>
                      {user.emailVerified ? "✓ Verified" : "Unverified"}
                    </td>
                    {/* Joined */}
                    <td className="px-4 py-3 text-xs" style={dim}>
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <EditUserDialog
                          user={user}
                          onUpdated={(updated) => setUsers((prev) => prev.map((u) => u.id === user.id ? updated : u))}
                        />
                        {!user.isMasterAdmin && (
                          <SetPasswordDialog userId={user.id} userName={user.name} />
                        )}
                        {!user.isMasterAdmin && (
                          <button
                            onClick={() => toggleActive(user)}
                            disabled={toggling === user.id}
                            className="text-xs px-2 py-1 rounded-md border hover:opacity-80 disabled:opacity-50"
                            style={user.isActive
                              ? { borderColor: "var(--sh-danger-border)", color: "var(--sh-danger)", background: "transparent" }
                              : { borderColor: "var(--sh-border2)", color: "var(--sh-primary)", background: "transparent" }}
                          >
                            {toggling === user.id ? "…" : user.isActive ? "Deactivate" : "Activate"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
