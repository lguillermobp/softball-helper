import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { registerSchema, leagueSetupSchema, seasonSchema } from "@/lib/validations";
import { sendVerificationEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const accountParsed = registerSchema.safeParse(body.account);
    const leagueParsed = leagueSetupSchema.safeParse(body.league);
    const seasonParsed = seasonSchema.safeParse(body.season);

    if (!accountParsed.success) {
      return NextResponse.json({ error: "Invalid account data" }, { status: 400 });
    }
    if (!leagueParsed.success) {
      return NextResponse.json({ error: "Invalid league data" }, { status: 400 });
    }
    if (!seasonParsed.success) {
      return NextResponse.json({ error: "Invalid season data" }, { status: 400 });
    }

    const { name, email, password } = accountParsed.data;
    const { name: leagueName, city, state, planId } = leagueParsed.data;
    const { name: seasonName, startDate, endDate } = seasonParsed.data;
    const categories: string[] = body.categories ?? [];
    const teams: string[] = body.teams ?? [];

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }

    const plan = await prisma.plan.findFirst({ where: { isActive: true } });
    if (!plan) {
      return NextResponse.json({ error: "No active plans available" }, { status: 500 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const slug = slugify(leagueName);
    const existingLeague = await prisma.league.findUnique({ where: { slug } });
    const finalSlug = existingLeague ? `${slug}-${Date.now()}` : slug;

    const result: { user: { id: string }; league: { slug: string } } = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name, email, password: hashedPassword },
      });

      const league = await tx.league.create({
        data: {
          name: leagueName,
          slug: finalSlug,
          city,
          state,
          planId: plan.id,
        },
      });

      await tx.userLeagueRole.create({
        data: { userId: user.id, leagueId: league.id, role: "LEAGUE_ADMIN" },
      });

      const season = await tx.season.create({
        data: {
          leagueId: league.id,
          name: seasonName,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
        },
      });

      const createdCategories = await Promise.all(
        categories
          .filter((c) => c.trim())
          .map((catName) =>
            tx.category.create({ data: { leagueId: league.id, name: catName.trim() } })
          )
      );

      await Promise.all(
        teams
          .filter((t) => t.trim())
          .map((teamName) =>
            tx.team.create({
              data: {
                leagueId: league.id,
                seasonId: season.id,
                categoryId: createdCategories[0]?.id,
                name: teamName.trim(),
              },
            })
          )
      );

      return { user, league };
    });

    // Fire-and-forget — don't fail registration if email sending fails
    sendVerificationEmail(email, name).catch((e) =>
      console.error("[REGISTER] verification email failed:", e)
    );

    return NextResponse.json({ success: true, leagueSlug: result.league.slug });
  } catch (err) {
    console.error("[REGISTER]", err);
    return NextResponse.json({ error: "Registration failed. Please try again." }, { status: 500 });
  }
}
