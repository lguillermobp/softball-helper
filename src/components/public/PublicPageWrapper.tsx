"use client";

import { useState, useEffect, type ReactNode } from "react";

export function PublicPageWrapper({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = localStorage.getItem("pub_theme");
    if (saved === "light") setTheme("light");
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("pub_theme", next);
  }

  return (
    <div data-pub-theme={theme} style={{ minHeight: "100vh", background: "var(--pub-bg)", color: "var(--pub-text)", fontFamily: "sans-serif" }}>
      <style>{`
        [data-pub-theme] {
          --pub-bg: #0a0f0a;
          --pub-bg-card: #0d1a0d;
          --pub-bg-card2: #111c11;
          --pub-text: #f0fdf4;
          --pub-text2: #86efac;
          --pub-accent: #4ade80;
          --pub-border: #1a3a1a;
          --pub-border2: #0f1a0f;
          --pub-logo-bg: #14532d;
          --pub-muted: #9ca3af;
          --pub-danger: #f87171;
          --pub-gold: #fbbf24;
          --pub-accent-subtle: rgba(74,222,128,0.04);
          --pub-accent-a10: rgba(74,222,128,0.1);
        }
        [data-pub-theme="light"] {
          --pub-bg: #f0fdf4;
          --pub-bg-card: #ffffff;
          --pub-bg-card2: #ecfdf5;
          --pub-text: #14532d;
          --pub-text2: #166534;
          --pub-accent: #15803d;
          --pub-border: #bbf7d0;
          --pub-border2: #d1fae5;
          --pub-logo-bg: #dcfce7;
          --pub-muted: #6b7280;
          --pub-danger: #dc2626;
          --pub-gold: #d97706;
          --pub-accent-subtle: rgba(22,163,74,0.04);
          --pub-accent-a10: rgba(22,163,74,0.1);
        }
      `}</style>

      {/* Theme toggle — fixed top-right */}
      <button
        onClick={toggle}
        title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        style={{
          position: "fixed", top: 14, right: 14, zIndex: 200,
          width: 34, height: 34, borderRadius: "50%",
          border: "1px solid var(--pub-border)",
          background: "var(--pub-bg-card)",
          color: "var(--pub-accent)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", fontSize: 15,
          boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
        }}
      >
        {theme === "dark" ? "☀️" : "🌙"}
      </button>

      {children}
    </div>
  );
}
