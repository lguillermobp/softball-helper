"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function ChangePasswordButton() {
  const [open,            setOpen]            = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword,     setNewPassword]     = useState("");
  const [confirm,         setConfirm]         = useState("");
  const [saving,          setSaving]          = useState(false);
  const [error,           setError]           = useState("");
  const [done,            setDone]            = useState(false);

  function handleOpen() {
    setCurrentPassword(""); setNewPassword(""); setConfirm("");
    setError(""); setDone(false); setOpen(true);
  }

  async function handleSave() {
    setError("");
    if (newPassword !== confirm) { setError("New passwords don't match"); return; }
    if (newPassword.length < 8)  { setError("New password must be at least 8 characters"); return; }
    setSaving(true);
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Failed to change password"); return; }
    setDone(true);
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="text-sm px-3 py-1.5 rounded-md border transition-colors"
        style={{ borderColor: "var(--sh-border2)", color: "var(--sh-secondary)", background: "transparent" }}
      >
        Change password
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="w-full max-w-sm rounded-2xl border p-6 space-y-4"
            style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" }}>
            <h2 className="text-base font-bold" style={{ color: "var(--sh-text)" }}>Change password</h2>

            {done ? (
              <>
                <p className="text-sm" style={{ color: "#4ade80" }}>Password changed successfully.</p>
                <div className="flex justify-end">
                  <Button onClick={() => setOpen(false)} style={{ background: "#16a34a", color: "#fff" }}>Close</Button>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-3">
                  <div>
                    <Label style={{ color: "var(--sh-secondary)" }}>Current password</Label>
                    <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Your current password"
                      style={{ background: "var(--sh-bg-card2)", borderColor: "var(--sh-border)", color: "var(--sh-text)" }} />
                  </div>
                  <div>
                    <Label style={{ color: "var(--sh-secondary)" }}>New password</Label>
                    <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      style={{ background: "var(--sh-bg-card2)", borderColor: "var(--sh-border)", color: "var(--sh-text)" }} />
                  </div>
                  <div>
                    <Label style={{ color: "var(--sh-secondary)" }}>Confirm new password</Label>
                    <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Repeat new password"
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
                    {saving ? "Saving…" : "Change password"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
