"use client";

import { useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/context/language-context";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageSelector } from "@/components/ui/language-selector";
import { SignOutButton } from "@/components/ui/sign-out-button";

type Locale = "en" | "es";

interface Tutorial {
  key: string;
  roles: string[];
  video: string;              // basename in /public/help (…-en.mp4 / …-es.mp4)
  poster: string;
  t: Record<Locale, { title: string; desc: string }>;
  roleLabel: Record<Locale, string>;
}

const TUTORIALS: Tutorial[] = [
  {
    key: "admin",
    roles: ["LEAGUE_ADMIN"],
    video: "admin",
    poster: "/help/admin-poster.png",
    roleLabel: { en: "League Admin", es: "Administrador" },
    t: {
      en: { title: "Setting up your league", desc: "Create a season, add a category and teams, assign a manager, and schedule a game." },
      es: { title: "Configura tu liga", desc: "Crea una temporada, agrega una categoría y equipos, asigna un manager y programa un juego." },
    },
  },
  {
    key: "roster",
    roles: ["TEAM_MANAGER", "TEAM_MANAGER_PLAYER", "TEAM_ASSISTANT", "TEAM_ASSISTANT_PLAYER"],
    video: "roster",
    poster: "/help/roster-poster.png",
    roleLabel: { en: "Team Manager", es: "Manager de equipo" },
    t: {
      en: { title: "Managing your roster", desc: "Add, edit, photograph, and remove players on your team." },
      es: { title: "Gestiona tu róster", desc: "Agrega, edita, fotografía y elimina jugadores de tu equipo." },
    },
  },
  {
    key: "score",
    roles: ["SCOREKEEPER"],
    video: "score",
    poster: "/help/score-poster.png",
    roleLabel: { en: "Scorekeeper", es: "Anotador" },
    t: {
      en: { title: "Scoring a game", desc: "Start the game, set pitchers, record each at-bat, add runs, and submit the final result." },
      es: { title: "Anota un juego", desc: "Inicia el juego, elige lanzadores, registra cada turno, suma carreras y envía el resultado final." },
    },
  },
];

interface Faq { id: string; category: string; questionEn: string; questionEs: string; answerEn: string; answerEs: string; }

const UI = {
  en: { title: "Help & Tutorials", subtitle: "Short walkthroughs for the tasks you do most.", forYou: "For you", back: "Dashboard", home: "Home", signIn: "Sign in", none: "No tutorials available yet.",
    faqTitle: "Frequently Asked Questions", faqSubtitle: "Quick answers to common questions.", manageFaqs: "Manage FAQs",
    askTitle: "Have a question?", askSubtitle: "Ask below — we review every question and publish helpful answers here.",
    askPlaceholder: "Type your question…", askEmail: "Your email (optional, so we can follow up)", askSubmit: "Submit question", askSending: "Sending…",
    askThanks: "Thanks! Your question was submitted and will appear here once we review it.", askAnother: "Ask another" },
  es: { title: "Ayuda y tutoriales", subtitle: "Guías breves para las tareas más comunes.", forYou: "Para ti", back: "Panel", home: "Inicio", signIn: "Iniciar sesión", none: "Aún no hay tutoriales disponibles.",
    faqTitle: "Preguntas frecuentes", faqSubtitle: "Respuestas rápidas a dudas comunes.", manageFaqs: "Gestionar FAQs",
    askTitle: "¿Tienes una pregunta?", askSubtitle: "Escríbela abajo — revisamos cada pregunta y publicamos aquí las respuestas útiles.",
    askPlaceholder: "Escribe tu pregunta…", askEmail: "Tu correo (opcional, para poder responderte)", askSubmit: "Enviar pregunta", askSending: "Enviando…",
    askThanks: "¡Gracias! Tu pregunta fue enviada y aparecerá aquí cuando la revisemos.", askAnother: "Enviar otra" },
};

const askInputStyle = { background: "var(--sh-bg-card2)", borderColor: "var(--sh-border)", color: "var(--sh-text)" };
const askInputCls = "w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500";

function AskForm({ locale, L }: { locale: Locale; L: (typeof UI)["en"] }) {
  const [q, setQ] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending"); setErr("");
    const res = await fetch("/api/help/ask", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q, website, locale }),
    });
    if (res.ok) { setState("done"); setQ(""); }
    else { setState("error"); setErr((await res.json().catch(() => ({}))).error ?? "Something went wrong"); }
  }

  if (state === "done") {
    return (
      <div className="rounded-2xl border p-6" style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" }}>
        <p className="font-semibold mb-3" style={{ color: "var(--sh-primary)" }}>✓ {L.askThanks}</p>
        <button onClick={() => setState("idle")} className="text-sm px-3 py-1.5 rounded-md border"
          style={{ borderColor: "var(--sh-border2)", color: "var(--sh-secondary)", background: "transparent" }}>{L.askAnother}</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border p-6 space-y-3" style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" }}>
      <textarea required minLength={8} maxLength={500} rows={3} value={q} onChange={(e) => setQ(e.target.value)}
        className={askInputCls} style={askInputStyle} placeholder={L.askPlaceholder} />
      {/* honeypot — hidden from real users */}
      <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)}
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1 }} aria-hidden="true" />
      {state === "error" && <p className="text-sm" style={{ color: "#f87171" }}>{err}</p>}
      <div className="flex justify-end">
        <button type="submit" disabled={state === "sending"} className="text-sm px-4 py-2 rounded-md font-semibold disabled:opacity-50"
          style={{ background: "var(--sh-primary)", color: "#04120a" }}>{state === "sending" ? L.askSending : L.askSubmit}</button>
      </div>
    </form>
  );
}

export function HelpView({ roles, isMasterAdmin, isAuthed, userName, faqs }: { roles: string[]; isMasterAdmin: boolean; isAuthed: boolean; userName: string | null; faqs: Faq[] }) {
  const { locale: rawLocale } = useLanguage();
  const locale: Locale = rawLocale === "es" ? "es" : "en";
  const ui = UI[locale];
  const mine = new Set(roles);

  const relevant = (t: Tutorial) => isMasterAdmin || t.roles.some((r) => mine.has(r));
  const sorted = [...TUTORIALS].sort((a, b) => Number(relevant(b)) - Number(relevant(a)));
  const faqCategories = [...new Set(faqs.map((f) => f.category))];

  return (
    <div className="min-h-screen" style={{ background: "var(--sh-bg-page)" }}>
      <header className="border-b sticky top-0 z-10" style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-header)" }}>
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={isAuthed ? "/dashboard" : "/"} className="text-sm flex items-center gap-1 transition-colors hover:opacity-80" style={{ color: "var(--sh-primary)" }}>
              ← {isAuthed ? ui.back : ui.home}
            </Link>
            <span style={{ color: "var(--sh-border2)" }}>|</span>
            <span className="font-bold" style={{ color: "var(--sh-text)" }}>{ui.title}</span>
          </div>
          <div className="flex items-center gap-2">
            {isAuthed && userName && <span className="hidden sm:inline text-sm" style={{ color: "var(--sh-secondary)" }}>{userName}</span>}
            <ThemeToggle />
            <LanguageSelector />
            {isAuthed ? (
              <SignOutButton />
            ) : (
              <Link href="/login" className="text-sm font-medium px-3 py-1.5 rounded-md border transition-colors hover:opacity-80"
                style={{ borderColor: "var(--sh-border2)", color: "var(--sh-primary)" }}>{ui.signIn}</Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8" style={{ color: "var(--sh-text)" }}>
        <h1 className="text-2xl font-black mb-1" style={{ color: "var(--sh-text)" }}>{ui.title}</h1>
        <p className="mb-8" style={{ color: "var(--sh-muted)" }}>{ui.subtitle}</p>

        {sorted.length === 0 ? (
          <p style={{ color: "var(--sh-muted)" }}>{ui.none}</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            {sorted.map((tut) => {
              const c = tut.t[locale];
              const forYou = relevant(tut);
              return (
                <div key={tut.key} className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" }}>
                  <div className="relative w-full" style={{ paddingBottom: "56.25%", background: "#000" }}>
                    <video
                      key={locale}
                      className="absolute inset-0 w-full h-full"
                      src={`/help/${tut.video}-${locale}.mp4`}
                      poster={tut.poster}
                      controls
                      playsInline
                      preload="none"
                    />
                  </div>
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--sh-bg-card2)", color: "var(--sh-primary)", border: "1px solid var(--sh-border2)" }}>
                        {tut.roleLabel[locale]}
                      </span>
                      {forYou && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.3)" }}>
                          ★ {ui.forYou}
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-lg" style={{ color: "var(--sh-text)" }}>{c.title}</h3>
                    <p className="text-sm mt-1" style={{ color: "var(--sh-muted)" }}>{c.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {faqs.length > 0 && (
          <section className="mt-14">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-2xl font-black mb-1" style={{ color: "var(--sh-text)" }}>{ui.faqTitle}</h2>
                <p className="mb-6" style={{ color: "var(--sh-muted)" }}>{ui.faqSubtitle}</p>
              </div>
              {isMasterAdmin && (
                <Link href="/admin/faqs" className="text-sm font-medium px-3 py-1.5 rounded-md border transition-colors hover:opacity-80"
                  style={{ borderColor: "var(--sh-border2)", color: "var(--sh-primary)" }}>{ui.manageFaqs}</Link>
              )}
            </div>
            {faqCategories.map((cat) => (
              <div key={cat} className="mb-6">
                <h3 className="text-sm font-bold uppercase tracking-wider mb-2" style={{ color: "var(--sh-primary)" }}>{cat}</h3>
                <div className="space-y-2">
                  {faqs.filter((f) => f.category === cat).map((f) => (
                    <details key={f.id} className="rounded-xl border overflow-hidden group" style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" }}>
                      <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-3 font-semibold" style={{ color: "var(--sh-text)" }}>
                        <span>{locale === "es" ? f.questionEs : f.questionEn}</span>
                        <span className="shrink-0 transition-transform group-open:rotate-180" style={{ color: "var(--sh-muted)" }}>⌄</span>
                      </summary>
                      <div className="px-4 pb-4 text-sm whitespace-pre-line" style={{ color: "var(--sh-muted)" }}>
                        {locale === "es" ? f.answerEs : f.answerEn}
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}

        <section className="mt-14 max-w-2xl">
          <h2 className="text-2xl font-black mb-1" style={{ color: "var(--sh-text)" }}>{ui.askTitle}</h2>
          <p className="mb-5" style={{ color: "var(--sh-muted)" }}>{ui.askSubtitle}</p>
          <AskForm locale={locale} L={ui} />
        </section>
      </main>
    </div>
  );
}
