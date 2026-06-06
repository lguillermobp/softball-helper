import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import { logAudit, getRequestMeta } from "@/lib/audit";

const getResend = () => new Resend(process.env.RESEND_API_KEY);
const FROM      = process.env.EMAIL_FROM ?? "Softball Helper <onboarding@resend.dev>";

interface Params { params: Promise<{ slug: string }> }

interface RecipientInput {
  email: string;
  name: string | null;
  teamName: string;
}

// ── HTML helpers ──────────────────────────────────────────────────────────────

function section(title: string, body: string) {
  return `
    <div style="margin:28px 0 0;">
      <h2 style="font-size:15px;font-weight:700;color:#4ade80;margin:0 0 12px;
                 padding-bottom:6px;border-bottom:1px solid #1e3a1e;">${title}</h2>
      ${body}
    </div>`;
}

function table(headers: string[], rows: string[][]) {
  const th = headers.map((h) =>
    `<th style="text-align:left;padding:6px 10px;font-size:11px;font-weight:600;
               text-transform:uppercase;letter-spacing:.05em;color:#6b7280;
               border-bottom:1px solid #1e3a1e;">${h}</th>`
  ).join("");
  const trs = rows.map((cols) => {
    const tds = cols.map((c) =>
      `<td style="padding:7px 10px;font-size:13px;color:#e5e7eb;
                  border-bottom:1px solid #111f11;">${c}</td>`
    ).join("");
    return `<tr>${tds}</tr>`;
  }).join("");
  return `<table style="width:100%;border-collapse:collapse;background:#0d1f0d;
                         border-radius:8px;overflow:hidden;">
    <thead><tr>${th}</tr></thead>
    <tbody>${trs}</tbody>
  </table>`;
}

function buildEmail(opts: {
  leagueName: string;
  recipientName: string | null;
  teamName: string;
  roster?: { name: string; jerseyNumber: string | null }[];
  games?: {
    date: string; opponent: string; field: string | null;
    status: string; homeScore: number | null; awayScore: number | null; isHome: boolean;
  }[];
  seasonName?: string;
  conditions?: { title: string; content: string | null }[];
  weekLabel?: string;
}): string {
  const greeting = opts.recipientName ? `Hi ${opts.recipientName},` : "Hi,";

  let sections = "";

  if (opts.roster) {
    const rows = opts.roster.map((p) => [p.jerseyNumber ? `#${p.jerseyNumber}` : "—", p.name]);
    sections += section(`🧢 Roster — ${opts.teamName}`,
      opts.roster.length === 0
        ? `<p style="color:#6b7280;font-size:13px;">No players registered yet.</p>`
        : table(["#", "Player"], rows)
    );
  }

  if (opts.games !== undefined) {
    const rows = opts.games.map((g) => {
      const d = new Date(g.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
      const homeAway = g.isHome ? "Home" : "Away";
      const score = g.status === "COMPLETED" && g.homeScore !== null && g.awayScore !== null
        ? `${g.homeScore} – ${g.awayScore}` : "—";
      const statusLabel = g.status === "COMPLETED" ? "Done" : g.status === "IN_PROGRESS" ? "Live" : "Scheduled";
      return [d, g.opponent, homeAway, g.field ?? "—", score, statusLabel];
    });
    sections += section(
      `📅 Schedule${opts.seasonName ? ` — ${opts.seasonName}` : ""}${opts.weekLabel ? ` · ${opts.weekLabel}` : ""}`,
      opts.games.length === 0
        ? `<p style="color:#6b7280;font-size:13px;">No games scheduled yet.</p>`
        : table(["Date", "Opponent", "H/A", "Field", "Score", "Status"], rows)
    );
  }

  if (opts.conditions?.length) {
    const body = opts.conditions.map((c) => `
      <div style="margin-bottom:14px;">
        <p style="font-size:13px;font-weight:600;color:#d1fae5;margin:0 0 4px;">${c.title}</p>
        ${c.content
          ? `<p style="font-size:13px;color:#9ca3af;margin:0;white-space:pre-wrap;">${c.content}</p>`
          : ""}
      </div>`).join("");
    sections += section("📋 Conditions", body);
  }

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a1a0a;font-family:sans-serif;">
  <div style="max-width:600px;margin:32px auto;padding:32px 24px;background:#0f2310;
              border-radius:12px;border:1px solid #1e3a1e;">

    <div style="margin-bottom:24px;">
      <p style="font-size:22px;font-weight:700;color:#4ade80;margin:0 0 4px;">
        ${opts.leagueName}
      </p>
      <p style="font-size:13px;color:#6b7280;margin:0;">League communication</p>
    </div>

    <p style="font-size:14px;color:#d1fae5;margin:0 0 4px;">${greeting}</p>
    <p style="font-size:14px;color:#9ca3af;margin:0 0 20px;">
      Here is the latest information for your team <strong style="color:#d1fae5;">${opts.teamName}</strong>.
    </p>

    ${sections}

    <p style="font-size:12px;color:#374151;margin:28px 0 0;text-align:center;">
      Sent via Softball Helper · ${opts.leagueName}
    </p>
  </div>
</body>
</html>`;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const userId     = session.user.id!;
  const isMasterAdmin = (session.user as any).isMasterAdmin;

  const league = await prisma.league.findUnique({
    where: { slug },
    include: { userRoles: { where: { userId } } },
  });
  if (!league) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = isMasterAdmin || league.userRoles.some((r) => r.role === "LEAGUE_ADMIN");
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { recipients, includeRoster, includeConditions, includeSchedule, seasonId, weekStart, weekEnd }
    : {
        recipients: RecipientInput[];
        includeRoster: boolean;
        includeConditions: boolean;
        includeSchedule: boolean;
        seasonId: string | null;
        weekStart: string | null;
        weekEnd: string | null;
      } = await req.json();

  if (!recipients?.length)
    return NextResponse.json({ error: "No recipients selected" }, { status: 400 });

  // ── Load shared data ────────────────────────────────────────────────────────

  const [allTeams, conditions, season] = await Promise.all([
    prisma.team.findMany({
      where: { leagueId: league.id },
      include: {
        manager:   { select: { email: true } },
        assistant: { select: { email: true } },
        players:   includeRoster
          ? { orderBy: { jerseyNumber: "asc" }, select: { name: true, jerseyNumber: true } }
          : false,
      },
    }),
    includeConditions
      ? prisma.condition.findMany({
          where: { leagueId: league.id },
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
          select: { title: true, content: true },
        })
      : Promise.resolve(null),
    includeSchedule && seasonId
      ? prisma.season.findUnique({ where: { id: seasonId } })
      : Promise.resolve(null),
  ]);

  // Load games for the season if needed
  const allGames = includeSchedule && seasonId
    ? await prisma.game.findMany({
        where: {
          seasonId,
          ...(weekStart && weekEnd ? {
            scheduledAt: {
              gte: new Date(weekStart + "T00:00:00"),
              lte: new Date(weekEnd   + "T23:59:59"),
            },
          } : {}),
        },
        orderBy: { scheduledAt: "asc" },
        select: {
          id: true, scheduledAt: true, status: true,
          homeScore: true, awayScore: true,
          homeTeamId: true, awayTeamId: true,
          homeTeam: { select: { id: true, name: true } },
          awayTeam: { select: { id: true, name: true } },
          field:    { select: { name: true } },
        },
      })
    : [];

  // ── Send emails ─────────────────────────────────────────────────────────────

  let sent = 0;
  let failed = 0;

  await Promise.all(recipients.map(async (r) => {
    // Find which team this person manages/assists
    const team = allTeams.find(
      (t) => t.manager?.email === r.email || t.assistant?.email === r.email
    );
    if (!team) { failed++; return; }

    const roster = includeRoster && team.players
      ? (team.players as { name: string; jerseyNumber: string | null }[])
      : undefined;

    const games = includeSchedule
      ? allGames
          .filter((g) => g.homeTeamId === team.id || g.awayTeamId === team.id)
          .map((g) => {
            const isHome = g.homeTeamId === team.id;
            return {
              date:       g.scheduledAt.toISOString(),
              opponent:   isHome ? g.awayTeam.name : g.homeTeam.name,
              field:      g.field?.name ?? null,
              status:     g.status,
              homeScore:  g.homeScore,
              awayScore:  g.awayScore,
              isHome,
            };
          })
      : undefined;

    const weekLabel = weekStart && weekEnd
      ? `Week of ${new Date(weekStart + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}–${new Date(weekEnd + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
      : undefined;

    const html = buildEmail({
      leagueName:    league.name,
      recipientName: r.name,
      teamName:      r.teamName,
      roster,
      games,
      seasonName:    season?.name,
      weekLabel,
      conditions:    conditions ?? undefined,
    });

    try {
      await getResend().emails.send({
        from: FROM,
        to: r.email,
        subject: `${league.name} — League update for ${r.teamName}`,
        html,
      });
      sent++;
    } catch (e) {
      console.error(`[BROADCAST] failed to send to ${r.email}:`, e);
      failed++;
    }
  }));

  await logAudit({ actor: session.user as any, action: "broadcast.send", leagueId: league.id, leagueName: league.name, metadata: { sent, failed, recipientCount: recipients.length, includeRoster, includeConditions, includeSchedule, seasonId }, ...getRequestMeta(req) });
  return NextResponse.json({ sent, failed });
}
