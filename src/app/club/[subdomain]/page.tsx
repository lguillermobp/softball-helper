import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

interface Props { params: Promise<{ subdomain: string }> }

async function loadClub(key: string) {
  const k = decodeURIComponent(key).toLowerCase();
  return prisma.club.findFirst({
    where: { OR: [{ subdomain: k }, { slug: k }] },
    select: {
      id: true, name: true,
      teams: {
        orderBy: { name: "asc" },
        select: {
          id: true, name: true,
          league: { select: { name: true } },
          players: { where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } },
        },
      },
    },
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { subdomain } = await params;
  const club = await loadClub(subdomain);
  return { title: club ? `${club.name} — Dugout Admin` : "Club — Dugout Admin" };
}

export default async function ClubPublicPage({ params }: Props) {
  const { subdomain } = await params;
  const club = await loadClub(subdomain);
  if (!club) notFound();

  // Group the club's teams by league.
  const byLeague = new Map<string, typeof club.teams>();
  for (const t of club.teams) {
    const l = t.league.name;
    let arr = byLeague.get(l);
    if (!arr) { arr = []; byLeague.set(l, arr); }
    arr.push(t);
  }
  const leagues = [...byLeague.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="min-h-screen" style={{ background: "var(--sh-bg)" }}>
      <header className="border-b" style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-header)" }}>
        <div className="mx-auto max-w-3xl px-4 py-6">
          <h1 className="text-3xl font-black" style={{ color: "var(--sh-text)" }}>{club.name}</h1>
          <p className="text-sm mt-1" style={{ color: "var(--sh-muted)" }}>
            {club.teams.length} team{club.teams.length !== 1 ? "s" : ""} across {leagues.length} league{leagues.length !== 1 ? "s" : ""}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 space-y-8">
        {leagues.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--sh-muted)" }}>No teams yet.</p>
        ) : leagues.map(([leagueName, teams]) => (
          <section key={leagueName} className="space-y-3">
            <h2 className="text-xs font-black uppercase tracking-widest" style={{ color: "var(--sh-primary)" }}>{leagueName}</h2>
            <div className="grid gap-3">
              {teams.map((t) => (
                <div key={t.id} className="rounded-xl border p-4" style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" }}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h3 className="font-bold" style={{ color: "var(--sh-text)" }}>{t.name}</h3>
                    <span className="text-xs" style={{ color: "var(--sh-muted)" }}>{t.players.length} player{t.players.length !== 1 ? "s" : ""}</span>
                  </div>
                  {t.players.length > 0 && (
                    <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                      {t.players.map((p) => (
                        <li key={p.id} className="text-sm" style={{ color: "var(--sh-secondary)" }}>{p.name}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </main>

      <footer className="border-t py-6" style={{ borderColor: "var(--sh-border-soft)" }}>
        <div className="mx-auto max-w-3xl px-4 text-center text-xs" style={{ color: "var(--sh-text-faint)" }}>
          Powered by Dugout Admin
        </div>
      </footer>
    </div>
  );
}
