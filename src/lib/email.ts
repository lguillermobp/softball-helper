import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = "Softball Helper <onboarding@resend.dev>";
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

  await resend.emails.send({
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

export async function sendMemberInviteEmail(
  email: string,
  leagueName: string,
  role: string
) {
  const token = await createVerificationToken(email);
  const url = `${APP_URL}/api/auth/verify-email?token=${token}&email=${encodeURIComponent(email)}`;
  const roleLabel = role.replace(/_/g, " ").toLowerCase();

  await resend.emails.send({
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
