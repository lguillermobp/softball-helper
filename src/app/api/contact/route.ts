import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const CONTACT_RECIPIENT = "lguillermobp@gmail.com";
const FROM = process.env.EMAIL_FROM ?? "Softball Helper <onboarding@resend.dev>";

export async function POST(req: NextRequest) {
  const { name, email, subject, message } = await req.json();

  if (!name?.trim() || !email?.trim() || !subject?.trim() || !message?.trim())
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });

  const resend = new Resend(process.env.RESEND_API_KEY);

  await resend.emails.send({
    from: FROM,
    to: CONTACT_RECIPIENT,
    replyTo: email,
    subject: `[SoftballHelper Contact] ${subject}`,
    html: `
      <div style="font-family:sans-serif;max-width:540px;margin:0 auto;padding:32px 24px;background:#0f2310;color:#f0fdf4;border-radius:12px;">
        <h1 style="color:#4ade80;font-size:20px;margin-bottom:4px;">New contact message</h1>
        <p style="color:#86efac;font-size:13px;margin-bottom:24px;">Via SoftballHelper homepage</p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
          <tr><td style="color:#4ade80;font-weight:600;padding:6px 0;width:90px;">Name</td><td style="color:#f0fdf4;padding:6px 0;">${name}</td></tr>
          <tr><td style="color:#4ade80;font-weight:600;padding:6px 0;">Email</td><td style="color:#f0fdf4;padding:6px 0;"><a href="mailto:${email}" style="color:#86efac;">${email}</a></td></tr>
          <tr><td style="color:#4ade80;font-weight:600;padding:6px 0;">Subject</td><td style="color:#f0fdf4;padding:6px 0;">${subject}</td></tr>
        </table>
        <div style="background:#1a3320;border-radius:8px;padding:16px;">
          <p style="color:#4ade80;font-weight:600;margin-bottom:8px;font-size:13px;">Message</p>
          <p style="color:#f0fdf4;white-space:pre-wrap;line-height:1.6;">${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
        </div>
      </div>
    `,
  });

  return NextResponse.json({ ok: true });
}
