"use client";

import { signOut } from "next-auth/react";

interface Props {
  label?: string;
}

export function SignOutButton({ label = "Sign out" }: Props) {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="text-sm px-3 py-1.5 rounded-md border transition-colors"
      style={{ borderColor: "var(--sh-border2)", color: "var(--sh-secondary)", background: "transparent" }}
    >
      {label}
    </button>
  );
}
