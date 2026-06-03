"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LanguageSelector } from "@/components/ui/language-selector";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useLanguage } from "@/context/language-context";

function StitchDivider() {
  return (
    <div className="flex items-center gap-3 justify-center my-2">
      <div className="h-px flex-1" style={{ background: "var(--sh-border-dim)" }} />
      <svg width="28" height="14" viewBox="0 0 28 14" fill="none" style={{ color: "var(--sh-border-dim)" }}>
        <ellipse cx="7" cy="7" rx="6" ry="5" stroke="currentColor" strokeWidth="1.5" />
        <ellipse cx="21" cy="7" rx="6" ry="5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 4 Q14 7 10 10" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        <path d="M18 4 Q14 7 18 10" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      </svg>
      <div className="h-px flex-1" style={{ background: "var(--sh-border-dim)" }} />
    </div>
  );
}

function DiamondIcon({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} style={style}>
      <rect x="24" y="4" width="20" height="20" rx="2" transform="rotate(45 24 4)" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="2" />
      <circle cx="24" cy="24" r="4" fill="currentColor" />
    </svg>
  );
}

const FLAGS = [
  { code: "us", name: "EEUU" },
  { code: "ve", name: "Venezuela" },
  { code: "pr", name: "Puerto Rico" },
  { code: "do", name: "Rep. Dominicana" },
  { code: "cu", name: "Cuba" },
  { code: "co", name: "Colombia" },
  { code: "jp", name: "Japón" },
];

export default function HomePage() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: "var(--sh-hero-bg)", color: "var(--sh-text)" }}>

      {/* ── Nav ─────────────────────────────────────────────────────── */}
      <nav
        className="relative z-10 border-b backdrop-blur-sm sticky top-0"
        style={{ borderColor: "var(--sh-border-soft)", background: "var(--sh-nav-bg)" }}
      >
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Softball Helper" className="h-9 w-auto" />
          </div>

          {/* Country flags */}
          <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto scrollbar-none">
            {FLAGS.map(({ code, name }) => (
              <div key={code} title={name} className="flex flex-col items-center gap-1 group cursor-default shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://flagcdn.com/w40/${code}.png`}
                  alt={name}
                  width={32}
                  height={22}
                  className="rounded-sm shadow-md transition-transform group-hover:scale-125 object-cover"
                />
                <span
                  className="hidden sm:block text-[9px] font-medium tracking-wide whitespace-nowrap transition-colors"
                  style={{ color: "var(--sh-text-faint)" }}
                >
                  {name}
                </span>
              </div>
            ))}
          </div>

          {/* Auth + Controls */}
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/login">
              <Button
                variant="ghost"
                size="sm"
                style={{ color: "var(--sh-text-dim)" }}
              >
                {t.nav.signin}
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm" className="bg-green-500 hover:bg-green-400 text-black font-bold">
                {t.nav.getStarted}
              </Button>
            </Link>
            <div className="w-px h-5" style={{ background: "var(--sh-border-soft)" }} />
            <ThemeToggle />
            <LanguageSelector />
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg,transparent,transparent 60px,var(--sh-border-soft) 60px,var(--sh-border-soft) 61px),repeating-linear-gradient(0deg,transparent,transparent 60px,var(--sh-border-soft) 60px,var(--sh-border-soft) 61px)",
          }}
        />
        {/* Glow blob */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full blur-3xl pointer-events-none"
          style={{ background: "var(--sh-accent-bg)" }}
        />
        {/* Decorative circles */}
        <div className="absolute -right-24 -top-24 w-80 h-80 rounded-full border-[20px] pointer-events-none" style={{ borderColor: "var(--sh-border-soft)" }} />
        <div className="absolute -left-16 bottom-0 w-56 h-56 rounded-full border-[12px] pointer-events-none" style={{ borderColor: "var(--sh-border-soft)" }} />

        <div className="relative mx-auto max-w-6xl px-4 pt-20 pb-24 text-center">
          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold mb-8"
            style={{ borderColor: "var(--sh-accent-border)", background: "var(--sh-accent-bg)", color: "var(--sh-primary)" }}
          >
            <span>⚾</span>
            <span>{t.hero.badge}</span>
            <span>⚾</span>
          </div>

          <h1 className="text-5xl sm:text-7xl font-black tracking-tight leading-none mb-6">
            <span className="block" style={{ color: "var(--sh-text)" }}>{t.hero.headline1}</span>
            <span className="block bg-gradient-to-r from-green-400 via-green-300 to-emerald-400 bg-clip-text text-transparent">
              {t.hero.headline2}
            </span>
          </h1>

          <StitchDivider />

          <p className="mt-6 text-lg sm:text-xl max-w-xl mx-auto leading-relaxed" style={{ color: "var(--sh-text-dim)" }}>
            {t.hero.tagline}
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button
                size="lg"
                className="w-full sm:w-auto px-10 py-6 text-base font-black bg-green-500 hover:bg-green-400 text-black rounded-full shadow-lg shadow-green-500/30 transition-all hover:scale-105"
              >
                {t.hero.cta}
              </Button>
            </Link>
            <Link href="/login">
              <Button
                size="lg"
                className="w-full sm:w-auto px-10 py-6 text-base font-semibold rounded-full"
                style={{
                  borderColor: "var(--sh-border-dim)",
                  background: "transparent",
                  color: "var(--sh-text)",
                  border: "1px solid var(--sh-border-dim)",
                }}
              >
                {t.hero.signin}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats bar ───────────────────────────────────────────────── */}
      <div className="border-y" style={{ borderColor: "var(--sh-border-soft)", background: "var(--sh-section-bg)" }}>
        <div className="mx-auto max-w-6xl px-4 py-5 grid grid-cols-3 gap-4 text-center">
          {t.stats.map((stat) => (
            <div key={stat.label}>
              <p className="text-xl sm:text-2xl font-black" style={{ color: "var(--sh-primary)" }}>{stat.value}</p>
              <p className="text-xs sm:text-sm mt-0.5" style={{ color: "var(--sh-text-muted)" }}>{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Features ────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-black mb-3" style={{ color: "var(--sh-text)" }}>{t.features.title}</h2>
          <p className="max-w-md mx-auto" style={{ color: "var(--sh-text-muted)" }}>{t.features.subtitle}</p>
        </div>

        <div className="grid sm:grid-cols-3 gap-6">
          {t.features.cards.map((f) => (
            <div key={f.title} className={`relative rounded-2xl border ${f.border} bg-gradient-to-b ${f.accent} p-6 overflow-hidden`}>
              <DiamondIcon className="absolute -right-4 -bottom-4 w-24 h-24 opacity-5" style={{ color: "var(--sh-text)" }} />
              <div className="text-4xl mb-4">{f.icon}</div>
              <h3 className="text-lg font-black mb-2" style={{ color: "var(--sh-text)" }}>{f.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--sh-text-muted)" }}>{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────── */}
      <section className="border-y py-20" style={{ borderColor: "var(--sh-border-soft)", background: "var(--sh-section-bg)" }}>
        <div className="mx-auto max-w-4xl px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black mb-3" style={{ color: "var(--sh-text)" }}>{t.steps.title}</h2>
            <p style={{ color: "var(--sh-text-muted)" }}>{t.steps.subtitle}</p>
          </div>

          <div className="grid sm:grid-cols-4 gap-6">
            {t.steps.items.map((s, i) => (
              <div key={i} className="flex flex-col items-center text-center relative">
                {i < 3 && (
                  <div
                    className="hidden sm:block absolute left-full top-8 w-full h-px border-t border-dashed -z-0"
                    style={{ borderColor: "var(--sh-border-dim)" }}
                  />
                )}
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-2xl mb-3 relative z-10"
                  style={{ background: "var(--sh-step-bg)", border: "1px solid var(--sh-step-border)" }}
                >
                  {s.icon}
                </div>
                <span className="text-xs font-black tracking-widest" style={{ color: "var(--sh-primary)" }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-sm font-semibold mt-1" style={{ color: "var(--sh-text)" }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-24 text-center">
        <div className="relative inline-block mb-6">
          <span className="text-6xl sm:text-8xl">🥎</span>
        </div>
        <h2 className="text-4xl sm:text-5xl font-black mb-4" style={{ color: "var(--sh-text)" }}>{t.cta.title}</h2>
        <p className="mb-10 max-w-md mx-auto text-lg" style={{ color: "var(--sh-text-muted)" }}>{t.cta.subtitle}</p>
        <Link href="/register">
          <Button
            size="lg"
            className="px-12 py-6 text-base font-black bg-green-500 hover:bg-green-400 text-black rounded-full shadow-xl shadow-green-500/30 transition-all hover:scale-105"
          >
            {t.cta.button}
          </Button>
        </Link>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="border-t py-8" style={{ borderColor: "var(--sh-border-soft)" }}>
        <div className="mx-auto max-w-6xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Softball Helper" className="h-7 w-auto" />
          </div>
          <p className="text-sm" style={{ color: "var(--sh-text-faint)" }}>
            © {new Date().getFullYear()} SoftballHelper. {t.footer}
          </p>
        </div>
      </footer>
    </div>
  );
}
