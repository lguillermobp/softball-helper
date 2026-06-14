import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

const FROM = process.env.EMAIL_FROM ?? "Softball Helper <onboarding@resend.dev>";
const APP_URL = process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "http://localhost:3001";

export async function createVerificationToken(email: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await prisma.verificationToken.deleteMany({ where: { identifier: email } });
  await prisma.verificationToken.create({ data: { identifier: email, token, expires } });

  return token;
}

export async function sendVerificationEmail(email: string, name: string | null) {
  const token = await createVerificationToken(email);
  const url = `${APP_URL}/api/auth/verify-email?token=${token}&email=${encodeURIComponent(email)}`;

  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: "Verify your Softball Helper email",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0f2310;color:#f0fdf4;border-radius:12px;">
        <h1 style="color:#4ade80;font-size:22px;margin-bottom:8px;">Welcome${name ? `, ${name}` : ""}!</h1>
        <p style="color:#86efac;margin-bottom:24px;">Please verify your email address to activate your Softball Helper account.</p>
        <a href="${url}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;">
          Verify email
        </a>
        <p style="color:#4ade80;font-size:12px;margin-top:24px;">This link expires in 24 hours. If you didn't create an account, you can ignore this email.</p>
      </div>
    `,
  });
}

// Sent to admin-created users (no password) — link leads to verify → set password
export async function sendStaffInviteEmail(
  email: string,
  name: string,
  leagueName: string,
  role: string
) {
  const token = await createVerificationToken(email);
  const url = `${APP_URL}/api/auth/verify-email?token=${token}&email=${encodeURIComponent(email)}`;
  const roleLabel = role.replace(/_/g, " ").toLowerCase();

  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: `You've been added to ${leagueName} on Softball Helper`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0f2310;color:#f0fdf4;border-radius:12px;">
        <h1 style="color:#4ade80;font-size:22px;margin-bottom:8px;">Welcome, ${name}!</h1>
        <p style="color:#86efac;margin-bottom:8px;">You've been added to <strong style="color:#f0fdf4;">${leagueName}</strong> as <strong style="color:#f0fdf4;">${roleLabel}</strong>.</p>
        <p style="color:#86efac;margin-bottom:24px;">Click below to verify your email and set your password to access Softball Helper.</p>
        <a href="${url}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;">
          Verify email &amp; set password
        </a>
        <p style="color:#4ade80;font-size:12px;margin-top:24px;">This link expires in 24 hours.</p>
      </div>
    `,
  });
}

// Sent to existing verified users when they are added to a league/team
export async function sendRoleNotificationEmail(
  email: string,
  name: string | null,
  leagueName: string,
  roleDescription: string   // human-readable, e.g. "team manager" or "player in Tigers"
) {
  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: `You've been added to ${leagueName} on Softball Helper`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0f2310;color:#f0fdf4;border-radius:12px;">
        <h1 style="color:#4ade80;font-size:22px;margin-bottom:8px;">You're in${name ? `, ${name}` : ""}!</h1>
        <p style="color:#86efac;margin-bottom:8px;">You've been added to <strong style="color:#f0fdf4;">${leagueName}</strong> as <strong style="color:#f0fdf4;">${roleDescription}</strong>.</p>
        <p style="color:#86efac;margin-bottom:24px;">Log in to Softball Helper to access your league.</p>
        <a href="${APP_URL}/login" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;">
          Go to Softball Helper
        </a>
      </div>
    `,
  });
}

// Sent to new users added as players — link takes them through verify → set password
export async function sendPlayerInviteEmail(
  email: string,
  name: string,
  teamName: string,
  leagueName: string
) {
  const token = await createVerificationToken(email);
  const url = `${APP_URL}/api/auth/verify-email?token=${token}&email=${encodeURIComponent(email)}`;

  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: `You've been added to ${teamName} on Softball Helper`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0f2310;color:#f0fdf4;border-radius:12px;">
        <h1 style="color:#4ade80;font-size:22px;margin-bottom:8px;">Welcome, ${name}!</h1>
        <p style="color:#86efac;margin-bottom:8px;">You've been added to team <strong style="color:#f0fdf4;">${teamName}</strong> in <strong style="color:#f0fdf4;">${leagueName}</strong> as a player.</p>
        <p style="color:#86efac;margin-bottom:24px;">Set up your Softball Helper account to track your stats and stay connected with your team.</p>
        <a href="${url}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;">
          Verify email &amp; set password
        </a>
        <p style="color:#4ade80;font-size:12px;margin-top:24px;">This link expires in 24 hours. No account is required to play — this is only needed if you want to view your stats.</p>
      </div>
    `,
  });
}

// Sent when a manager adds a player with an email — player must click to confirm ownership
// before their account is linked. identifier = "player-invite:{playerId}"
export async function sendPlayerAcceptInviteEmail(
  email: string,
  playerName: string,
  teamName: string,
  leagueName: string,
  playerId: string,
) {
  const token = await createVerificationToken(`player-invite:${playerId}`);
  const url = `${APP_URL}/api/auth/accept-player-invite?token=${token}`;

  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: `Confirm your spot on ${teamName} — Softball Helper`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0f2310;color:#f0fdf4;border-radius:12px;">
        <h1 style="color:#4ade80;font-size:22px;margin-bottom:8px;">You've been added, ${playerName}!</h1>
        <p style="color:#86efac;margin-bottom:8px;">
          <strong style="color:#f0fdf4;">${leagueName}</strong> has added you as a player
          on team <strong style="color:#f0fdf4;">${teamName}</strong>.
        </p>
        <p style="color:#86efac;margin-bottom:24px;">
          Click below to confirm this is you and activate your access.
        </p>
        <a href="${url}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;">
          Confirm &amp; join team
        </a>
        <p style="color:#4ade80;font-size:12px;margin-top:24px;">
          This link expires in 24 hours. If you don't recognise this league, you can safely ignore this email.
        </p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(email: string, name: string | null) {
  const token = await createVerificationToken(email);
  const url = `${APP_URL}/set-password?token=${token}&email=${encodeURIComponent(email)}`;

  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: "Reset your Softball Helper password",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0f2310;color:#f0fdf4;border-radius:12px;">
        <h1 style="color:#4ade80;font-size:22px;margin-bottom:8px;">Password Reset${name ? `, ${name}` : ""}</h1>
        <p style="color:#86efac;margin-bottom:24px;">A league administrator has requested a password reset for your Softball Helper account. Click below to set a new password.</p>
        <a href="${url}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;">
          Set new password
        </a>
        <p style="color:#4ade80;font-size:12px;margin-top:24px;">This link expires in 24 hours. If you didn't request this, you can ignore this email.</p>
      </div>
    `,
  });
}

export async function sendMemberInviteEmail(
  email: string,
  leagueName: string,
  role: string
) {
  const token = await createVerificationToken(email);
  const url = `${APP_URL}/api/auth/verify-email?token=${token}&email=${encodeURIComponent(email)}`;
  const roleLabel = role.replace(/_/g, " ").toLowerCase();

  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: `You've been added to ${leagueName} on Softball Helper`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0f2310;color:#f0fdf4;border-radius:12px;">
        <h1 style="color:#4ade80;font-size:22px;margin-bottom:8px;">You're in!</h1>
        <p style="color:#86efac;margin-bottom:8px;">You've been added to <strong style="color:#f0fdf4;">${leagueName}</strong> as <strong style="color:#f0fdf4;">${roleLabel}</strong>.</p>
        <p style="color:#86efac;margin-bottom:24px;">Please verify your email to access the league.</p>
        <a href="${url}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;">
          Verify email
        </a>
        <p style="color:#4ade80;font-size:12px;margin-top:24px;">This link expires in 24 hours.</p>
      </div>
    `,
  });
}

// ─── Game end notification ────────────────────────────────────────────────────

export async function sendGameEndNotification(opts: {
  to: string;
  leagueName: string;
  homeTeam: string; awayTeam: string;
  homeScore: number; awayScore: number;
  scheduledAt: Date;
  fieldName: string | null;
}) {
  const date = opts.scheduledAt.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const time = opts.scheduledAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const winner = opts.homeScore > opts.awayScore ? opts.homeTeam : opts.awayScore > opts.homeScore ? opts.awayTeam : null;
  const resultLine = winner ? `${winner} won` : "Tie game";

  await getResend().emails.send({
    from: FROM,
    to: opts.to,
    subject: `Game finished: ${opts.homeTeam} vs ${opts.awayTeam} — ${opts.leagueName}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0f2310;color:#f0fdf4;border-radius:12px;">
        <p style="color:#4ade80;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 8px;">⚾ Game Finished — ${opts.leagueName}</p>
        <h1 style="color:#f0fdf4;font-size:22px;font-weight:800;margin:0 0 20px;">${opts.homeTeam} vs ${opts.awayTeam}</h1>
        <div style="background:#1a3320;border-radius:12px;padding:20px;margin-bottom:20px;text-align:center;">
          <div style="display:flex;align-items:center;justify-content:center;gap:24px;">
            <div>
              <p style="color:#86efac;font-size:12px;margin:0 0 4px;">${opts.homeTeam}</p>
              <p style="color:#f0fdf4;font-size:40px;font-weight:900;margin:0;line-height:1;">${opts.homeScore}</p>
            </div>
            <p style="color:#4ade80;font-size:18px;font-weight:700;margin:0;">–</p>
            <div>
              <p style="color:#86efac;font-size:12px;margin:0 0 4px;">${opts.awayTeam}</p>
              <p style="color:#f0fdf4;font-size:40px;font-weight:900;margin:0;line-height:1;">${opts.awayScore}</p>
            </div>
          </div>
          <p style="color:#4ade80;font-size:14px;font-weight:700;margin:16px 0 0;">${resultLine}</p>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <tr><td style="color:#4ade80;padding:4px 0;width:80px;">📅 Date</td><td style="color:#f0fdf4;">${date} at ${time}</td></tr>
          ${opts.fieldName ? `<tr><td style="color:#4ade80;padding:4px 0;">📍 Field</td><td style="color:#f0fdf4;">${opts.fieldName}</td></tr>` : ""}
        </table>
        <p style="color:#4ade80;font-size:11px;margin-top:24px;opacity:0.6;">Softball Helper · Game end notification</p>
      </div>
    `,
  });
}

// ─── Support ticket emails ────────────────────────────────────────────────────

function ticketCard(title: string, body: string, meta: Record<string, string>, ticketUrl: string, actionLabel: string) {
  const rows = Object.entries(meta).map(
    ([k, v]) => `<tr><td style="color:#4ade80;font-weight:600;padding:5px 0;width:110px;vertical-align:top;">${k}</td><td style="color:#f0fdf4;padding:5px 0;">${v}</td></tr>`
  ).join("");
  return `
    <div style="font-family:sans-serif;max-width:540px;margin:0 auto;padding:32px 24px;background:#0f2310;color:#f0fdf4;border-radius:12px;">
      <h1 style="color:#4ade80;font-size:20px;margin-bottom:4px;">${title}</h1>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">${rows}</table>
      <div style="background:#1a3320;border-radius:8px;padding:16px;margin-bottom:20px;">
        <p style="color:#4ade80;font-weight:600;margin-bottom:8px;font-size:13px;">Message</p>
        <p style="color:#f0fdf4;white-space:pre-wrap;line-height:1.6;">${body.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
      </div>
      <a href="${ticketUrl}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;">${actionLabel}</a>
    </div>`;
}

export async function sendNewTicketToAssignee(opts: {
  toEmail: string; toName: string | null;
  ticketId: string; title: string; body: string;
  category: string; leagueName: string | null;
  creatorName: string; creatorEmail: string;
}) {
  const url = `${APP_URL}/support/tickets/${opts.ticketId}`;
  await getResend().emails.send({
    from: FROM,
    to: opts.toEmail,
    subject: `[SoftballHelper Support] New ticket: ${opts.title}`,
    html: ticketCard(
      `New support ticket assigned to you`,
      opts.body,
      {
        "From":     `${opts.creatorName} (${opts.creatorEmail})`,
        "Category": opts.category,
        ...(opts.leagueName ? { "League": opts.leagueName } : {}),
      },
      url,
      "View ticket"
    ),
  });
}

export async function sendNewTicketToLeagueAdmin(opts: {
  toEmail: string; toName: string | null;
  ticketId: string; title: string; body: string;
  leagueName: string; creatorName: string; creatorEmail: string;
}) {
  const url = `${APP_URL}/support/tickets/${opts.ticketId}`;
  await getResend().emails.send({
    from: FROM,
    to: opts.toEmail,
    replyTo: opts.creatorEmail,
    subject: `[SoftballHelper] League issue reported: ${opts.title}`,
    html: ticketCard(
      `A league issue has been reported`,
      opts.body,
      {
        "From":   `${opts.creatorName} (${opts.creatorEmail})`,
        "League": opts.leagueName,
      },
      url,
      "View ticket"
    ),
  });
}

export async function sendTicketReplyNotification(opts: {
  toEmail: string;
  ticketId: string; ticketTitle: string;
  replyAuthorName: string; replyBody: string;
}) {
  const url = `${APP_URL}/support/tickets/${opts.ticketId}`;
  await getResend().emails.send({
    from: FROM,
    to: opts.toEmail,
    subject: `[SoftballHelper Support] New reply on: ${opts.ticketTitle}`,
    html: ticketCard(
      `New reply on your ticket`,
      opts.replyBody,
      { "From": opts.replyAuthorName, "Ticket": opts.ticketTitle },
      url,
      "View thread"
    ),
  });
}
