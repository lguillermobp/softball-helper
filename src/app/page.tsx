"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LanguageSelector } from "@/components/ui/language-selector";
import { useLanguage } from "@/context/language-context";

function StitchDivider() {
  return (
    <div className="flex items-center gap-3 justify-center my-2">
      <div className="h-px flex-1 bg-white/20" />
      <svg width="28" height="14" viewBox="0 0 28 14" fill="none">
        <ellipse cx="7" cy="7" rx="6" ry="5" stroke="white" strokeOpacity="0.4" strokeWidth="1.5" />
        <ellipse cx="21" cy="7" rx="6" ry="5" stroke="white" strokeOpacity="0.4" strokeWidth="1.5" />
        <path d="M10 4 Q14 7 10 10" stroke="white" strokeOpacity="0.4" strokeWidth="1" strokeLinecap="round" />
        <path d="M18 4 Q14 7 18 10" stroke="white" strokeOpacity="0.4" strokeWidth="1" strokeLinecap="round" />
      </svg>
      <div className="h-px flex-1 bg-white/20" />
    </div>
  );
}

function DiamondIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className}>
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
    <div className="min-h-screen bg-[#0f1f0f] text-white overflow-x-hidden">

      {/* ── Nav ─────────────────────────────────────────────────────── */}
      <nav className="relative z-10 border-b border-white/10 backdrop-blur-sm bg-black/30">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-2xl">🥎</span>
            <span className="text-xl font-black tracking-tight text-white">
              Softball<span className="text-green-400">Helper</span>
            </span>
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
                <span className="hidden sm:block text-[9px] text-white/30 group-hover:text-white/60 transition-colors font-medium tracking-wide whitespace-nowrap">
                  {name}
                </span>
              </div>
            ))}
          </div>

          {/* Auth + Language */}
          <div className="flex items-center gap-3 shrink-0">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10">
                {t.nav.signin}
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm" className="bg-green-500 hover:bg-green-400 text-black font-bold">
                {t.nav.getStarted}
              </Button>
            </Link>
            <div className="w-px h-5 bg-white/10" />
            <LanguageSelector />
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg,transparent,transparent 60px,rgba(255,255,255,0.03) 60px,rgba(255,255,255,0.03) 61px),repeating-linear-gradient(0deg,transparent,transparent 60px,rgba(255,255,255,0.03) 60px,rgba(255,255,255,0.03) 61px)",
          }}
        />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-green-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -right-24 -top-24 w-80 h-80 rounded-full border-[20px] border-white/5 pointer-events-none" />
        <div className="absolute -left-16 bottom-0 w-56 h-56 rounded-full border-[12px] border-white/5 pointer-events-none" />

        <div className="relative mx-auto max-w-6xl px-4 pt-20 pb-24 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-green-500/30 bg-green-500/10 px-4 py-1.5 text-sm font-semibold text-green-400 mb-8">
            <span>⚾</span>
            <span>{t.hero.badge}</span>
            <span>⚾</span>
          </div>

          <h1 className="text-5xl sm:text-7xl font-black tracking-tight leading-none mb-6">
            <span className="block text-white">{t.hero.headline1}</span>
            <span className="block bg-gradient-to-r from-green-400 via-green-300 to-emerald-400 bg-clip-text text-transparent">
              {t.hero.headline2}
            </span>
          </h1>

          <StitchDivider />

          <p className="mt-6 text-lg sm:text-xl text-white/60 max-w-xl mx-auto leading-relaxed">
            {t.hero.tagline}
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" className="w-full sm:w-auto px-10 py-6 text-base font-black bg-green-500 hover:bg-green-400 text-black rounded-full shadow-lg shadow-green-500/30 transition-all hover:scale-105">
                {t.hero.cta}
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="w-full sm:w-auto px-10 py-6 text-base font-semibold border-white/20 bg-transparent text-white hover:bg-white/10 rounded-full">
                {t.hero.signin}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats bar ───────────────────────────────────────────────── */}
      <div className="border-y border-white/10 bg-white/5">
        <div className="mx-auto max-w-6xl px-4 py-5 grid grid-cols-3 gap-4 text-center">
          {t.stats.map((stat) => (
            <div key={stat.label}>
              <p className="text-xl sm:text-2xl font-black text-green-400">{stat.value}</p>
              <p className="text-xs sm:text-sm text-white/50 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Features ────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-3">{t.features.title}</h2>
          <p className="text-white/50 max-w-md mx-auto">{t.features.subtitle}</p>
        </div>

        <div className="grid sm:grid-cols-3 gap-6">
          {t.features.cards.map((f) => (
            <div key={f.title} className={`relative rounded-2xl border ${f.border} bg-gradient-to-b ${f.accent} p-6 overflow-hidden`}>
              <DiamondIcon className="absolute -right-4 -bottom-4 w-24 h-24 text-white opacity-5" />
              <div className="text-4xl mb-4">{f.icon}</div>
              <h3 className="text-lg font-black text-white mb-2">{f.title}</h3>
              <p className="text-sm text-white/50 leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────── */}
      <section className="bg-white/5 border-y border-white/10 py-20">
        <div className="mx-auto max-w-4xl px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-3">{t.steps.title}</h2>
            <p className="text-white/50">{t.steps.subtitle}</p>
          </div>

          <div className="grid sm:grid-cols-4 gap-6">
            {t.steps.items.map((s, i) => (
              <div key={i} className="flex flex-col items-center text-center relative">
                {i < 3 && (
                  <div className="hidden sm:block absolute left-full top-8 w-full h-px border-t border-dashed border-white/20 -z-0" />
                )}
                <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center text-2xl mb-3 relative z-10">
                  {s.icon}
                </div>
                <span className="text-xs font-black text-green-400 tracking-widest">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-sm font-semibold text-white mt-1">{s.label}</span>
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
        <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">{t.cta.title}</h2>
        <p className="text-white/50 mb-10 max-w-md mx-auto text-lg">{t.cta.subtitle}</p>
        <Link href="/register">
          <Button size="lg" className="px-12 py-6 text-base font-black bg-green-500 hover:bg-green-400 text-black rounded-full shadow-xl shadow-green-500/30 transition-all hover:scale-105">
            {t.cta.button}
          </Button>
        </Link>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="border-t border-white/10 py-8">
        <div className="mx-auto max-w-6xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">🥎</span>
            <span className="font-black text-white">
              Softball<span className="text-green-400">Helper</span>
            </span>
          </div>
          <p className="text-sm text-white/30">
            © {new Date().getFullYear()} SoftballHelper. {t.footer}
          </p>
        </div>
      </footer>
    </div>
  );
}
