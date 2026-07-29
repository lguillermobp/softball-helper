import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Best-effort in-memory rate limit (the app runs as a single long-lived server).
const hits = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > MAX_PER_WINDOW;
}

export async function POST(req: NextRequest) {
  let b: { question?: string; email?: string; locale?: string; website?: string };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  // Honeypot: bots fill this hidden field; real users never see it. Pretend success.
  if (b.website) return NextResponse.json({ ok: true });

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "Too many questions right now. Please try again in a minute." }, { status: 429 });
  }

  const question = (b.question ?? "").trim();
  const email = (b.email ?? "").trim();
  const locale = b.locale === "es" ? "es" : "en";

  if (question.length < 8 || question.length > 500)
    return NextResponse.json({ error: "Please enter a question between 8 and 500 characters." }, { status: 400 });
  if (email && (email.length > 200 || !email.includes("@")))
    return NextResponse.json({ error: "Please enter a valid email or leave it blank." }, { status: 400 });

  await prisma.faq.create({
    data: {
      category: "Submitted",
      status: "PENDING",
      questionEn: locale === "en" ? question : "",
      questionEs: locale === "es" ? question : "",
      answerEn: "",
      answerEs: "",
      submitterEmail: email || null,
      active: true,
    },
  });

  return NextResponse.json({ ok: true });
}
