"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface Props {
  userId: string;
  userName: string | null;
}

export function SetPasswordDialog({ userId, userName }: Props) {
  const [open,     setOpen]     = useState(false);
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState("");
  const [done,     setDone]     = useState(false);

  function handleOpen() {
    setPassword(""); setConfirm(""); setError(""); setDone(false); setOpen(true);
  }

  async function handleSave() {
    setError("");
    if (password !== confirm) { setError("Passwords don't match"); return; }
    if (password.length < 8)  { setError("Password must be at least 8 characters"); return; }
    setSaving(true);
    const res = await fetch(`/api/admin/users/${userId}/set-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Failed to set password"); return; }
    setDone(true);
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="text-xs px-2 py-1 rounded-md border hover:opacity-80"
        style={{ borderColor: "var(--sh-border2)", color: "#fbbf24", background: "transparent" }}
      >
        Set password
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="w-full max-w-sm rounded-2xl border p-6 space-y-4" style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" }}>
            <h2 className="text-base font-bold" style={{ color: "var(--sh-text)" }}>
              Set password{userName ? ` — ${userName}` : ""}
            </h2>

            {done ? (
              <>
                <p className="text-sm" style={{ color: "#4ade80" }}>Password updated successfully.</p>
                <div className="flex justify-end">
                  <Button onClick={() => setOpen(false)} style={{ background: "#16a34a", color: "#fff" }}>Close</Button>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-3">
                  <div>
                    <Label style={{ color: "var(--sh-secondary)" }}>New password</Label>
                    <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      style={{ background: "var(--sh-bg-card2)", borderColor: "var(--sh-border)", color: "var(--sh-text)" }} />
                  </div>
                  <div>
                    <Label style={{ color: "var(--sh-secondary)" }}>Confirm password</Label>
                    <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Repeat password"
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
                    {saving ? "Saving…" : "Set password"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </Dialog>
    </>
  );
}
