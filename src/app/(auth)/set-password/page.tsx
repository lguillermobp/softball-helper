"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const email = searchParams.get("email") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Passwords don't match"); return; }
    if (password.length < 8)  { setError("Password must be at least 8 characters"); return; }

    setLoading(true);
    const res = await fetch("/api/auth/set-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, email, password }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) { setError(data.error ?? "Something went wrong"); return; }
    router.push("/login?password-set=1");
  }

  if (!token || !email) {
    return (
      <div className="text-center" style={{ color: "#f87171" }}>
        Invalid link. Please contact your league admin.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="password" style={{ color: "#86efac" }}>New password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          required
          style={{ background: "#1a3d1a", borderColor: "#2d5a2d", color: "#f0fdf4" }}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="confirm" style={{ color: "#86efac" }}>Confirm password</Label>
        <Input
          id="confirm"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Repeat your password"
          required
          style={{ background: "#1a3d1a", borderColor: "#2d5a2d", color: "#f0fdf4" }}
        />
      </div>
      {error && <p className="text-sm" style={{ color: "#f87171" }}>{error}</p>}
      <Button type="submit" disabled={loading} className="w-full" style={{ background: "#16a34a", color: "#fff" }}>
        {loading ? "Saving…" : "Set password & continue"}
      </Button>
    </form>
  );
}

export default function SetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#0f1f0f" }}>
      <div className="w-full max-w-sm rounded-2xl border p-8 space-y-6" style={{ borderColor: "#1e3a1e", background: "#0f2310" }}>
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-1" style={{ color: "#4ade80" }}>Set your password</h1>
          <p className="text-sm" style={{ color: "#86efac" }}>
            Choose a password to activate your Softball Helper account.
          </p>
        </div>
        <Suspense>
          <SetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
