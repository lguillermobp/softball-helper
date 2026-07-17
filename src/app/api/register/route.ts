import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { registerSchema, leagueSetupSchema, seasonSchema } from "@/lib/validations";
import { sendVerificationEmail } from "@/lib/email";

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
    const seasonParsed = seasonSchema.safeParse(body.season);

    if (!leagueParsed.success)
      return NextResponse.json({ error: "Invalid league data" }, { status: 400 });
    if (!seasonParsed.success)
      return NextResponse.json({ error: "Invalid season data" }, { status: 400 });

    const { name: leagueName, city, state, planId, couponCode } = leagueParsed.data;
    const { name: seasonName, startDate, endDate } = seasonParsed.data;
    const categories: string[] = body.categories ?? [];
    const teams: string[]      = body.teams      ?? [];

    // Resolve the selected plan
    const plan = await prisma.plan.findFirst({ where: { id: planId, isActive: true } });
    if (!plan) return NextResponse.json({ error: "Selected plan not found" }, { status: 400 });

    const slug = slugify(leagueName);
    const existingLeague = await prisma.league.findUnique({ where: { slug } });
    const finalSlug = existingLeague ? `${slug}-${Date.now()}` : slug;

    // ── Logged-in path: use existing user ──────────────────────────────────────
    if (body.userId) {
      const session = await auth();
      if (!session?.user?.id || session.user.id !== body.userId)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

      const userEmail = session.user.email ?? "";
      const coupon = await resolveCoupon(couponCode, userEmail);

      const result = await prisma.$transaction(async (tx) => {
        const league = await tx.league.create({
          data: {
            name: leagueName, slug: finalSlug, city, state, planId: plan.id,
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

        const season = await tx.season.create({
          data: { leagueId: league.id, name: seasonName, startDate: new Date(startDate), endDate: new Date(endDate) },
        });

        const createdCategories = await Promise.all(
          categories.filter((c) => c.trim()).map((catName) =>
            tx.category.create({ data: { leagueId: league.id, name: catName.trim() } })
          )
        );

        await Promise.all(
          teams.filter((t) => t.trim()).map((teamName) =>
            tx.team.create({
              data: { leagueId: league.id, seasonId: season.id, categoryId: createdCategories[0]?.id, name: teamName.trim() },
            })
          )
        );

        return { league };
      });

      return NextResponse.json({ success: true, leagueSlug: result.league.slug });
    }

    // ── New user path: create account + league ─────────────────────────────────
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
          name: leagueName, slug: finalSlug, city, state, planId: plan.id,
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

      const season = await tx.season.create({
        data: { leagueId: league.id, name: seasonName, startDate: new Date(startDate), endDate: new Date(endDate) },
      });

      const createdCategories = await Promise.all(
        categories.filter((c) => c.trim()).map((catName) =>
          tx.category.create({ data: { leagueId: league.id, name: catName.trim() } })
        )
      );

      await Promise.all(
        teams.filter((t) => t.trim()).map((teamName) =>
          tx.team.create({
            data: { leagueId: league.id, seasonId: season.id, categoryId: createdCategories[0]?.id, name: teamName.trim() },
          })
        )
      );

      return { user, league };
    });

    sendVerificationEmail(email, name).catch((e) =>
      console.error("[REGISTER] verification email failed:", e)
    );

    return NextResponse.json({ success: true, leagueSlug: result.league.slug });
  } catch (err) {
    console.error("[REGISTER]", err);
    return NextResponse.json({ error: "Registration failed. Please try again." }, { status: 500 });
  }
}
