"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface AdminUser {
  id: string; name: string | null; email: string; phone: string | null;
  emailVerified: string | null; isMasterAdmin: boolean; isActive: boolean;
  createdAt: string; _count: { leagueRoles: number };
}

interface Props {
  user: AdminUser;
  onUpdated: (u: AdminUser) => void;
}

export function EditUserDialog({ user, onUpdated }: Props) {
  const [open, setOpen]     = useState(false);
  const [name,  setName]    = useState(user.name  ?? "");
  const [email, setEmail]   = useState(user.email);
  const [phone, setPhone]   = useState(user.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  const emailChanged = email !== user.email;

  async function handleSave() {
    setError("");
    setSaving(true);
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Failed to save"); return; }
    onUpdated(data);
    setOpen(false);
  }

  return (
    <>
      <button
        onClick={() => { setName(user.name ?? ""); setEmail(user.email); setPhone(user.phone ?? ""); setError(""); setOpen(true); }}
        className="text-xs px-2 py-1 rounded-md border hover:opacity-80"
        style={{ borderColor: "var(--sh-border2)", color: "var(--sh-primary)", background: "transparent" }}
      >
        Edit
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="w-full max-w-sm rounded-2xl border p-6 space-y-4" style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" }}>
            <h2 className="text-base font-bold" style={{ color: "var(--sh-text)" }}>Edit User</h2>

            <div className="space-y-3">
              <div>
                <Label style={{ color: "var(--sh-secondary)" }}>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)}
                  style={{ background: "var(--sh-bg-card2)", borderColor: "var(--sh-border)", color: "var(--sh-text)" }} />
              </div>
              <div>
                <Label style={{ color: "var(--sh-secondary)" }}>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  style={{ background: "var(--sh-bg-card2)", borderColor: "var(--sh-border)", color: "var(--sh-text)" }} />
                {emailChanged && (
                  <p className="text-xs mt-1" style={{ color: "#fbbf24" }}>
                    A new verification email will be sent to this address.
                  </p>
                )}
              </div>
              <div>
                <Label style={{ color: "var(--sh-secondary)" }}>Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)}
                  style={{ background: "var(--sh-bg-card2)", borderColor: "var(--sh-border)", color: "var(--sh-text)" }} />
              </div>
            </div>

            {error && <p className="text-xs" style={{ color: "#f87171" }}>{error}</p>}

            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => setOpen(false)}
                style={{ borderColor: "var(--sh-border2)", color: "var(--sh-secondary)", background: "transparent" }}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}
                style={{ background: "#16a34a", color: "#fff" }}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
