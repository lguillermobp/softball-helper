"use client";

import { useState } from "react";

export function ResendVerificationButton({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "loading" | "sent" | "error">("idle");

  async function handleClick() {
    setState("loading");
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setState(res.ok ? "sent" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "sent") {
    return <span className="text-xs" style={{ color: "#fbbf24" }}>Email sent</span>;
  }
  if (state === "error") {
    return <span className="text-xs" style={{ color: "#f87171" }}>Failed</span>;
  }

  return (
    <button
      onClick={handleClick}
      disabled={state === "loading"}
      className="text-xs underline transition-opacity hover:opacity-70 disabled:opacity-40"
      style={{ color: "#f87171" }}
    >
      {state === "loading" ? "Sending…" : "Unverified · Resend"}
    </button>
  );
}
