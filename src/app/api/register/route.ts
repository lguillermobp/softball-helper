import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cloudinary } from "@/lib/cloudinary";
import { slugify } from "@/lib/utils";
import { registerSchema, leagueSetupSchema } from "@/lib/validations";
import { sendVerificationEmail } from "@/lib/email";

async function uploadLogo(leagueId: string, dataUrl: string): Promise<string | null> {
  try {
    const result = await cloudinary.uploader.upload(dataUrl, {
      folder:         `softball-helper/${leagueId}/league`,
      public_id:      "logo",
      overwrite:      true,
      transformation: [{ width: 400, height: 400, crop: "fill" }],
      format:         "png",
    });
    return result.secure_url;
  } catch {
    return null;
  }
}

async function resolveCoupon(couponCode: string | undefined, email: string) {
  if (!couponCode?.trim()) return null;

  const code = couponCode.trim().toUpperCase();
  const coupon = await prisma.coupon.findUnique({ where: { code } });
  if (!coupon || !coupon.active) return null;
  if (coupon.expiresAt < new Date()) return null;
  if (coupon.maxRedemptions !== null && coupon.redemptionCount >= coupon.maxRedemptions) return null;
  if (coupon.type === "PERSONALIZED" && coupon.email !== email.toLowerCase()) return null;

  return coupon;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const leagueParsed = leagueSetupSchema.safeParse(body.league);
    if (!leagueParsed.success)
      return NextResponse.json({ error: "Invalid league data" }, { status: 400 });

    const { name: leagueName, city, state, type: leagueType, planId, couponCode } = leagueParsed.data;
    const logoDataUrl: string | undefined = body.logoDataUrl;

    const plan = await prisma.plan.findFirst({ where: { id: planId, isActive: true } });
    if (!plan) return NextResponse.json({ error: "Selected plan not found" }, { status: 400 });

    const slug = slugify(leagueName);
    const existingLeague = await prisma.league.findUnique({ where: { slug } });
    const finalSlug = existingLeague ? `${slug}-${Date.now()}` : slug;

    // ── Logged-in path ─────────────────────────────────────────────────────────
    if (body.userId) {
      const session = await auth();
      if (!session?.user?.id || session.user.id !== body.userId)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

      const userEmail = session.user.email ?? "";
      const coupon = await resolveCoupon(couponCode, userEmail);

      const result = await prisma.$transaction(async (tx) => {
        const league = await tx.league.create({
          data: {
            name: leagueName, slug: finalSlug, city, state, planId: plan.id, ...(leagueType ? { type: leagueType } : {}),
            ...(coupon ? { appliedCouponId: coupon.id } : {}),
          },
        });

        if (coupon) {
          await tx.coupon.update({
            where: { id: coupon.id },
            data:  { redemptionCount: { increment: 1 } },
          });
        }

        await tx.userLeagueRole.create({
          data: { userId: body.userId, leagueId: league.id, role: "LEAGUE_ADMIN" },
        });

        return { league };
      });

      if (logoDataUrl?.startsWith("data:image/")) {
        const logoUrl = await uploadLogo(result.league.id, logoDataUrl);
        if (logoUrl) await prisma.league.update({ where: { id: result.league.id }, data: { logoUrl } });
      }

      return NextResponse.json({ success: true, leagueSlug: result.league.slug });
    }

    // ── New user path ──────────────────────────────────────────────────────────
    const accountParsed = registerSchema.safeParse(body.account);
    if (!accountParsed.success)
      return NextResponse.json({ error: "Invalid account data" }, { status: 400 });

    const { name, email, password } = accountParsed.data;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser)
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });

    const hashedPassword = await bcrypt.hash(password, 12);
    const coupon = await resolveCoupon(couponCode, email);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { name, email, password: hashedPassword } });

      const league = await tx.league.create({
        data: {
          name: leagueName, slug: finalSlug, city, state, planId: plan.id, ...(leagueType ? { type: leagueType } : {}),
          ...(coupon ? { appliedCouponId: coupon.id } : {}),
        },
      });

      if (coupon) {
        await tx.coupon.update({
          where: { id: coupon.id },
          data:  { redemptionCount: { increment: 1 } },
        });
      }

      await tx.userLeagueRole.create({
        data: { userId: user.id, leagueId: league.id, role: "LEAGUE_ADMIN" },
      });

      return { user, league };
    });

    sendVerificationEmail(email, name).catch((e) =>
      console.error("[REGISTER] verification email failed:", e)
    );

    if (logoDataUrl?.startsWith("data:image/")) {
      const logoUrl = await uploadLogo(result.league.id, logoDataUrl);
      if (logoUrl) await prisma.league.update({ where: { id: result.league.id }, data: { logoUrl } });
    }

    return NextResponse.json({ success: true, leagueSlug: result.league.slug });
  } catch (err) {
    console.error("[REGISTER]", err);
    return NextResponse.json({ error: "Registration failed. Please try again." }, { status: 500 });
  }
}
