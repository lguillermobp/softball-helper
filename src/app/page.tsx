"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LanguageSelector } from "@/components/ui/language-selector";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useLanguage } from "@/context/language-context";

// ── SVG Decorations ───────────────────────────────────────────────────────────

function DiamondFieldSvg({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 400 400" fill="none" className={className} style={style} aria-hidden>
      <polygon points="200,40 360,200 200,360 40,200" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <line x1="200" y1="40" x2="200" y2="360" stroke="currentColor" strokeWidth="0.5" strokeDasharray="6,8" />
      <line x1="40" y1="200" x2="360" y2="200" stroke="currentColor" strokeWidth="0.5" strokeDasharray="6,8" />
      <path d="M 60 340 A 280 280 0 0 1 340 340" stroke="currentColor" strokeWidth="1" fill="none" />
      <circle cx="200" cy="200" r="20" stroke="currentColor" strokeWidth="1" fill="none" />
      <rect x="192" y="32" width="16" height="16" rx="2" fill="currentColor" fillOpacity="0.4" transform="rotate(45 200 40)" />
      <rect x="352" y="192" width="16" height="16" rx="2" fill="currentColor" fillOpacity="0.4" transform="rotate(45 360 200)" />
      <rect x="192" y="352" width="16" height="16" rx="2" fill="currentColor" fillOpacity="0.4" transform="rotate(45 200 360)" />
      <rect x="32" y="192" width="16" height="16" rx="2" fill="currentColor" fillOpacity="0.4" transform="rotate(45 40 200)" />
      <polygon points="200,355 210,365 210,375 190,375 190,365" fill="currentColor" fillOpacity="0.6" />
    </svg>
  );
}

function ScoreboardWidget() {
  return (
    <div
      className="inline-flex flex-col rounded-xl overflow-hidden border shadow-2xl text-left"
      style={{ background: "#000", borderColor: "rgba(74,222,128,0.3)", boxShadow: "0 0 50px rgba(74,222,128,0.12)" }}
    >
      <div className="px-4 py-2 flex items-center gap-2" style={{ background: "rgba(74,222,128,0.08)", borderBottom: "1px solid rgba(74,222,128,0.15)" }}>
        <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#4ade80", boxShadow: "0 0 6px #4ade80" }} />
        <span className="text-xs font-black tracking-widest uppercase" style={{ color: "#4ade80" }}>LIVE · INNING 5</span>
      </div>
      <div className="px-6 py-4 space-y-2">
        {[
          { name: "LOS TRES DEL CARIBE", score: "3", winning: true },
          { name: "CLEVELAND",           score: "1", winning: false },
        ].map(row => (
          <div key={row.name} className="flex items-center justify-between gap-10">
            <span className="text-sm font-black tracking-wide" style={{ color: row.winning ? "#f0fdf4" : "rgba(240,253,244,0.4)" }}>
              {row.name}
            </span>
            <span className="text-3xl font-black tabular-nums" style={{ color: row.winning ? "#4ade80" : "rgba(240,253,244,0.4)", textShadow: row.winning ? "0 0 20px rgba(74,222,128,0.6)" : "none" }}>
              {row.score}
            </span>
          </div>
        ))}
      </div>
      <div className="px-4 py-2 text-center" style={{ borderTop: "1px solid rgba(74,222,128,0.1)", background: "rgba(0,0,0,0.4)" }}>
        <span className="text-xs tracking-widest" style={{ color: "rgba(240,253,244,0.25)" }}>SOFTBALLHELPER.COM</span>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center gap-3 mb-4">
      <div className="h-px w-10" style={{ background: "#4ade80" }} />
      <span className="text-xs font-black tracking-widest uppercase" style={{ color: "#4ade80" }}>{children}</span>
      <div className="h-px w-10" style={{ background: "#4ade80" }} />
    </div>
  );
}

function StitchDivider() {
  return (
    <div className="flex items-center gap-3 justify-center my-2">
      <div className="h-px flex-1" style={{ background: "rgba(74,222,128,0.25)" }} />
      <svg width="28" height="14" viewBox="0 0 28 14" fill="none" style={{ color: "rgba(74,222,128,0.4)" }}>
        <ellipse cx="7" cy="7" rx="6" ry="5" stroke="currentColor" strokeWidth="1.5" />
        <ellipse cx="21" cy="7" rx="6" ry="5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 4 Q14 7 10 10" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        <path d="M18 4 Q14 7 18 10" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      </svg>
      <div className="h-px flex-1" style={{ background: "rgba(74,222,128,0.25)" }} />
    </div>
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

const CARD_ACCENT = [
  { border: "rgba(234,179,8,0.3)",  stripe: "#eab308", tag: "rgba(234,179,8,0.12)",  tagText: "#eab308" },
  { border: "rgba(74,222,128,0.3)", stripe: "#4ade80", tag: "rgba(74,222,128,0.12)", tagText: "#4ade80" },
  { border: "rgba(96,165,250,0.3)", stripe: "#60a5fa", tag: "rgba(96,165,250,0.12)", tagText: "#60a5fa" },
];

function DemoSection({ onRequestDemo }: { onRequestDemo: () => void }) {
  const { t, locale } = useLanguage();
  const td = t.demo;
  const demoSrc = `/demo/subscriptions-${locale === "es" ? "es" : "en"}.mp4`;

  return (
    <section id="demo" className="border-y py-24" style={{ borderColor: "var(--sh-border-soft)", background: "var(--sh-hero-bg)" }}>
      <div className="mx-auto max-w-5xl px-4">
        <div className="text-center mb-10">
          <SectionLabel>DEMO</SectionLabel>
          <h2 className="text-3xl sm:text-4xl font-black uppercase italic mb-3" style={{ color: "var(--sh-text)" }}>{td.title}</h2>
          <p className="max-w-xl mx-auto" style={{ color: "var(--sh-text-muted)" }}>{td.subtitle}</p>
        </div>

        <div className="rounded-2xl overflow-hidden border shadow-xl mb-8" style={{ borderColor: "var(--sh-border-soft)" }}>
          <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
            <video
              key={locale}
              className="absolute inset-0 w-full h-full"
              src={demoSrc}
              title={td.title}
              controls
              playsInline
              preload="metadata"
              poster="/demo/subscriptions-poster.png"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={onRequestDemo}
            className="px-10 py-4 text-base font-black rounded-full shadow-lg transition-all hover:scale-105 uppercase tracking-widest"
            style={{ background: "linear-gradient(135deg,#16a34a,#15803d)", color: "#fff", boxShadow: "0 0 24px rgba(74,222,128,0.3)" }}
          >
            {td.requestDemo}
          </button>
          <Link href="/register">
            <button className="w-full sm:w-auto px-10 py-4 text-base font-semibold rounded-full border transition-all hover:opacity-80" style={{ borderColor: "var(--sh-border-dim)", color: "var(--sh-text)", background: "transparent" }}>
              {t.hero.cta}
            </button>
          </Link>
        </div>
      </div>
    </section>
  );
}

function ContactSection({ defaultSubject }: { defaultSubject?: string }) {
  const { t } = useLanguage();
  const tc = t.contact;

  const [form, setForm]     = useState({ name: "", email: "", subject: defaultSubject ?? "", message: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");

  React.useEffect(() => {
    if (defaultSubject) setForm(f => ({ ...f, subject: defaultSubject }));
  }, [defaultSubject]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      setStatus(res.ok ? "success" : "error");
    } catch {
      setStatus("error");
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 14px", borderRadius: "10px", fontSize: "14px",
    border: "1px solid var(--sh-border-dim)", background: "var(--sh-section-bg)",
    color: "var(--sh-text)", outline: "none",
  };

  return (
    <section id="contact" className="border-t py-24" style={{ borderColor: "var(--sh-border-soft)", background: "var(--sh-hero-bg)" }}>
      <div className="mx-auto max-w-2xl px-4">
        <div className="text-center mb-10">
          <SectionLabel>CONTACT</SectionLabel>
          <h2 className="text-3xl sm:text-4xl font-black uppercase italic mb-3" style={{ color: "var(--sh-text)" }}>{tc.sectionTitle}</h2>
          <p className="max-w-md mx-auto" style={{ color: "var(--sh-text-muted)" }}>{tc.sectionSubtitle}</p>
        </div>

        {status === "success" ? (
          <div className="text-center py-12 rounded-2xl border" style={{ borderColor: "var(--sh-border-soft)", background: "var(--sh-section-bg)" }}>
            <div className="text-5xl mb-4">🥎</div>
            <h3 className="text-xl font-black uppercase mb-2" style={{ color: "#4ade80" }}>{tc.successTitle}</h3>
            <p style={{ color: "var(--sh-text-muted)" }}>{tc.successMsg}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="rounded-2xl border p-8 space-y-5" style={{ borderColor: "var(--sh-border-soft)", background: "var(--sh-section-bg)" }}>
            <div className="grid sm:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-widest" style={{ color: "#4ade80" }}>{tc.name}</label>
                <input required style={inputStyle} placeholder={tc.namePlaceholder} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-widest" style={{ color: "#4ade80" }}>{tc.email}</label>
                <input required type="email" style={inputStyle} placeholder={tc.emailPlaceholder} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-widest" style={{ color: "#4ade80" }}>{tc.subject}</label>
              <select required style={inputStyle} value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}>
                <option value="">—</option>
                {tc.subjects.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-widest" style={{ color: "#4ade80" }}>{tc.message}</label>
              <textarea required rows={5} style={{ ...inputStyle, resize: "vertical" }} placeholder={tc.messagePlaceholder} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} />
            </div>
            {status === "error" && <p className="text-sm font-medium" style={{ color: "#ef4444" }}>{tc.errorMsg}</p>}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-xs" style={{ color: "var(--sh-text-faint)" }}>
                {tc.directEmail}{" "}
                <a href="mailto:lguillermobp@gmail.com" className="underline" style={{ color: "#4ade80" }}>lguillermobp@gmail.com</a>
              </p>
              <Button type="submit" disabled={status === "sending"} className="w-full sm:w-auto px-8 py-3 font-black bg-green-500 hover:bg-green-400 text-black rounded-full transition-all hover:scale-105 disabled:opacity-60 disabled:scale-100 uppercase tracking-widest">
                {status === "sending" ? tc.sending : tc.send}
              </Button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { t, locale } = useLanguage();
  const [demoSubject, setDemoSubject] = useState("");

  function requestDemo() {
    setDemoSubject(t.demo.demoSubject);
    setTimeout(() => document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: "var(--sh-hero-bg)", color: "var(--sh-text)" }}>

      {/* ── Nav ─────────────────────────────────────────────────────── */}
      <nav className="relative z-10 backdrop-blur-sm sticky top-0" style={{ background: "var(--sh-nav-bg)", borderBottom: "1px solid var(--sh-border-soft)" }}>
        {/* Green speed line at bottom of nav */}
        <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent 0%, #4ade80 40%, #4ade80 60%, transparent 100%)" }} />
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-2xl">🥎</span>
            <span className="text-xl font-black tracking-tight" style={{ color: "var(--sh-text)" }}>
              Softball<span style={{ color: "#4ade80" }}>Helper</span>
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto scrollbar-none">
            {FLAGS.map(({ code, name }) => (
              <div key={code} title={name} className="flex flex-col items-center gap-1 group cursor-default shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`https://flagcdn.com/w40/${code}.png`} alt={name} width={32} height={22} className="rounded-sm shadow-md transition-transform group-hover:scale-125 object-cover" />
                <span className="hidden sm:block text-[9px] font-medium tracking-wide whitespace-nowrap" style={{ color: "var(--sh-text-faint)" }}>{name}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a href="#demo" className="hidden sm:inline-flex text-sm font-medium px-3 py-1.5 rounded-lg transition-colors hover:opacity-80" style={{ color: "var(--sh-text-dim)" }}>{t.nav.watchDemo}</a>
            <a href="#contact" className="hidden sm:inline-flex text-sm font-medium px-3 py-1.5 rounded-lg transition-colors hover:opacity-80" style={{ color: "var(--sh-text-dim)" }}>{t.nav.contactUs}</a>
            <Link href="/login">
              <Button variant="ghost" size="sm" style={{ color: "var(--sh-text-dim)" }}>{t.nav.signin}</Button>
            </Link>
            <Link href="/register">
              <Button size="sm" className="bg-green-500 hover:bg-green-400 text-black font-black uppercase tracking-wide">{t.nav.getStarted}</Button>
            </Link>
            <div className="w-px h-5" style={{ background: "var(--sh-border-soft)" }} />
            <ThemeToggle />
            <LanguageSelector />
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Diagonal field-chalk lines */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: "repeating-linear-gradient(135deg, transparent, transparent 80px, rgba(74,222,128,0.025) 80px, rgba(74,222,128,0.025) 81px)",
        }} />
        {/* Large diamond field art — upper right */}
        <DiamondFieldSvg className="absolute -right-20 -top-20 w-[520px] h-[520px] pointer-events-none" style={{ color: "#4ade80", opacity: 0.07 }} />
        {/* Green glow */}
        <div className="absolute top-0 left-1/4 w-[700px] h-[400px] rounded-full blur-3xl pointer-events-none" style={{ background: "rgba(74,222,128,0.05)" }} />
        {/* Left accent stripe */}
        <div className="absolute left-0 top-0 bottom-0 w-1.5 pointer-events-none" style={{ background: "linear-gradient(to bottom, #4ade80 0%, rgba(74,222,128,0.2) 60%, transparent 100%)" }} />

        <div className="relative mx-auto max-w-6xl px-4 pt-20 pb-28">
          <div className="flex flex-col lg:flex-row items-center gap-14 lg:gap-20">

            {/* Left — headline */}
            <div className="flex-1 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-black tracking-widest uppercase mb-8"
                style={{ borderColor: "rgba(74,222,128,0.35)", background: "rgba(74,222,128,0.07)", color: "#4ade80" }}>
                <span>⚾</span><span>{t.hero.badge}</span><span>⚾</span>
              </div>

              <h1 className="font-black uppercase leading-none mb-4"
                style={{ fontSize: "clamp(3rem,8vw,5.5rem)", letterSpacing: "-0.02em", fontStyle: "italic" }}>
                <span className="block" style={{ color: "var(--sh-text)" }}>{t.hero.headline1}</span>
                <span className="block" style={{ color: "#4ade80", textShadow: "0 0 40px rgba(74,222,128,0.4)" }}>
                  {t.hero.headline2}
                </span>
              </h1>

              <StitchDivider />

              <p className="mt-5 text-base sm:text-lg max-w-lg mx-auto lg:mx-0 leading-relaxed" style={{ color: "var(--sh-text-dim)" }}>
                {t.hero.tagline}
              </p>

              <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link href="/register">
                  <Button size="lg" className="w-full sm:w-auto px-10 py-6 text-base font-black bg-green-500 hover:bg-green-400 text-black rounded-full transition-all hover:scale-105 uppercase tracking-widest"
                    style={{ boxShadow: "0 0 35px rgba(74,222,128,0.4)" }}>
                    {t.hero.cta}
                  </Button>
                </Link>
                <button onClick={requestDemo}
                  className="w-full sm:w-auto px-10 py-6 text-base font-black rounded-full border transition-all hover:scale-105 uppercase tracking-widest"
                  style={{ borderColor: "rgba(74,222,128,0.4)", background: "rgba(74,222,128,0.06)", color: "#4ade80" }}>
                  ▶ {t.demo.requestDemo}
                </button>
                <Link href="/login">
                  <Button size="lg" className="w-full sm:w-auto px-10 py-6 text-base font-semibold rounded-full"
                    style={{ border: "1px solid var(--sh-border-dim)", background: "transparent", color: "var(--sh-text)" }}>
                    {t.hero.signin}
                  </Button>
                </Link>
              </div>
            </div>

            {/* Right — live scoreboard widget */}
            <div className="flex-shrink-0 flex flex-col items-center gap-4">
              <ScoreboardWidget />
              <div className="flex items-center gap-2">
                <div className="h-px w-8" style={{ background: "rgba(74,222,128,0.3)" }} />
                <span className="text-xs font-black tracking-widest uppercase" style={{ color: "rgba(74,222,128,0.5)" }}>Live scoring</span>
                <div className="h-px w-8" style={{ background: "rgba(74,222,128,0.3)" }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Scoreboard stats bar ─────────────────────────────────────── */}
      <div style={{ background: "#000", borderTop: "1px solid rgba(74,222,128,0.2)", borderBottom: "1px solid rgba(74,222,128,0.2)" }}>
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid grid-cols-3">
            {t.stats.map((stat, i) => (
              <div key={stat.label} className="relative flex flex-col items-center justify-center py-7 gap-1"
                style={{ borderRight: i < 2 ? "1px solid rgba(74,222,128,0.12)" : undefined }}>
                {/* LED indicator dot */}
                <div className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full" style={{ background: "#4ade80", boxShadow: "0 0 8px #4ade80" }} />
                <p className="text-2xl sm:text-3xl font-black italic tabular-nums"
                  style={{ color: "#4ade80", textShadow: "0 0 24px rgba(74,222,128,0.6)", letterSpacing: "-0.02em" }}>
                  {stat.value}
                </p>
                <p className="text-xs font-black tracking-widest uppercase" style={{ color: "rgba(240,253,244,0.35)" }}>
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Features ────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-24">
        <div className="text-center mb-14">
          <SectionLabel>FEATURES</SectionLabel>
          <h2 className="text-3xl sm:text-4xl font-black uppercase italic mb-3" style={{ color: "var(--sh-text)" }}>{t.features.title}</h2>
          <p className="max-w-md mx-auto" style={{ color: "var(--sh-text-muted)" }}>{t.features.subtitle}</p>
        </div>

        <div className="grid sm:grid-cols-3 gap-6">
          {t.features.cards.map((f, i) => {
            const a = CARD_ACCENT[i];
            return (
              <div key={f.title} className="relative rounded-2xl overflow-hidden"
                style={{ border: `1px solid ${a.border}`, background: "rgba(255,255,255,0.025)" }}>
                {/* Left accent stripe */}
                <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: a.stripe }} />
                {/* Large ghost jersey number */}
                <div className="absolute -right-2 -bottom-3 font-black pointer-events-none select-none"
                  style={{ fontSize: 96, lineHeight: 1, color: "rgba(255,255,255,0.025)" }}>
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div className="p-6 pl-8">
                  <div className="flex items-start justify-between mb-5">
                    <div className="text-4xl">{f.icon}</div>
                    <span className="text-xs font-black tracking-widest px-2.5 py-1 rounded-full uppercase"
                      style={{ background: a.tag, color: a.tagText }}>
                      #{String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="text-base font-black uppercase tracking-tight mb-2" style={{ color: "var(--sh-text)" }}>{f.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--sh-text-muted)" }}>{f.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────── */}
      <section className="border-y py-24" style={{ borderColor: "var(--sh-border-soft)", background: "rgba(0,0,0,0.35)" }}>
        <div className="mx-auto max-w-4xl px-4">
          <div className="text-center mb-14">
            <SectionLabel>PLAYBOOK</SectionLabel>
            <h2 className="text-3xl sm:text-4xl font-black uppercase italic mb-3" style={{ color: "var(--sh-text)" }}>{t.steps.title}</h2>
            <p style={{ color: "var(--sh-text-muted)" }}>{t.steps.subtitle}</p>
          </div>

          <div className="grid sm:grid-cols-4 gap-6">
            {t.steps.items.map((s, i) => (
              <div key={i} className="flex flex-col items-center text-center relative">
                {i < 3 && (
                  <div className="hidden sm:block absolute left-full top-9 w-full border-t-2 border-dashed -z-0"
                    style={{ borderColor: "rgba(74,222,128,0.2)" }} />
                )}
                <div className="flex items-center justify-center text-2xl mb-3 relative z-10 rounded-full"
                  style={{ width: 72, height: 72, background: "rgba(74,222,128,0.07)", border: "2px solid rgba(74,222,128,0.3)", boxShadow: "0 0 24px rgba(74,222,128,0.1)" }}>
                  {s.icon}
                </div>
                <span className="text-2xl font-black italic tabular-nums"
                  style={{ color: "#4ade80", textShadow: "0 0 16px rgba(74,222,128,0.5)" }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-sm font-black uppercase tracking-wide mt-1" style={{ color: "var(--sh-text)" }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Demo ────────────────────────────────────────────────────── */}
      <DemoSection onRequestDemo={requestDemo} />

      {/* ── CTA ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-28">
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: "repeating-linear-gradient(135deg, transparent, transparent 80px, rgba(74,222,128,0.02) 80px, rgba(74,222,128,0.02) 81px)",
        }} />
        <DiamondFieldSvg className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] pointer-events-none" style={{ color: "#4ade80", opacity: 0.05 }} />

        <div className="relative mx-auto max-w-6xl px-4 text-center">
          <span className="block text-6xl sm:text-8xl mb-6">🥎</span>
          <h2 className="text-4xl sm:text-6xl font-black uppercase italic mb-4"
            style={{ color: "var(--sh-text)", letterSpacing: "-0.02em" }}>
            {t.cta.title}
          </h2>
          <p className="mb-10 max-w-md mx-auto text-lg" style={{ color: "var(--sh-text-muted)" }}>{t.cta.subtitle}</p>
          <Link href="/register">
            <Button size="lg" className="px-14 py-7 text-lg font-black bg-green-500 hover:bg-green-400 text-black rounded-full transition-all hover:scale-105 uppercase tracking-widest"
              style={{ boxShadow: "0 0 50px rgba(74,222,128,0.4)" }}>
              {t.cta.button}
            </Button>
          </Link>
        </div>
      </section>

      {/* ── Contact ─────────────────────────────────────────────────── */}
      <ContactSection defaultSubject={demoSubject} />

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="border-t py-8" style={{ borderColor: "var(--sh-border-soft)" }}>
        <div className="mx-auto max-w-6xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">🥎</span>
            <span className="font-black" style={{ color: "var(--sh-text)" }}>
              Softball<span style={{ color: "#4ade80" }}>Helper</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#contact" className="text-sm hover:underline" style={{ color: "var(--sh-text-faint)" }}>{t.nav.contactUs}</a>
            <p className="text-sm" style={{ color: "var(--sh-text-faint)" }}>© {new Date().getFullYear()} SoftballHelper. {t.footer}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
