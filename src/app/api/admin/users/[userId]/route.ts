import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { Pool } from "pg";
import { sendVerificationEmail } from "@/lib/email";

interface Params { params: Promise<{ userId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!(session?.user as any)?.isMasterAdmin)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId } = await params;
  const body = await req.json();
  const { name, phone, email, isActive, isSupportTechnician } = body;

  const dbUrl = process.env.DATABASE_URL || process.env.DATABASE_PRIVATE_URL ||
    process.env.DATABASE_PUBLIC_URL || process.env.POSTGRES_URL || "";
  const pool = new Pool({ connectionString: dbUrl, ssl: false });

  try {
    const { rows: existing } = await pool.query(
      `SELECT id, email FROM users WHERE id = $1`, [userId]
    );
    if (existing.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const currentEmail = existing[0].email;
    const emailChanged = email && email !== currentEmail;

    if (emailChanged) {
      const { rows: conflict } = await pool.query(
        `SELECT id FROM users WHERE email = $1 AND id != $2`, [email, userId]
      );
      if (conflict.length > 0)
        return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }

    // Build dynamic SET clause
    const sets: string[] = [];
    const vals: any[]    = [];
    let idx = 1;
    if (name                !== undefined) { sets.push(`name = $${idx++}`);                     vals.push(name); }
    if (phone               !== undefined) { sets.push(`phone = $${idx++}`);                    vals.push(phone); }
    if (email               !== undefined) { sets.push(`email = $${idx++}`);                    vals.push(email); }
    if (emailChanged)                      { sets.push(`"emailVerified" = NULL`); }
    if (isActive            !== undefined) { sets.push(`"isActive" = $${idx++}`);               vals.push(isActive); }
    if (isSupportTechnician !== undefined) { sets.push(`"isSupportTechnician" = $${idx++}`);    vals.push(isSupportTechnician); }

    if (sets.length > 0) {
      vals.push(userId);
      await pool.query(`UPDATE users SET ${sets.join(", ")} WHERE id = $${idx}`, vals);
    }

    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.email, u.phone,
              u."emailVerified", u."isMasterAdmin", u."isSupportTechnician",
              COALESCE(u."isActive", true) AS "isActive",
              u."createdAt",
              COUNT(r.id)::int AS "leagueRoles"
       FROM users u
       LEFT JOIN user_league_roles r ON r."userId" = u.id
       WHERE u.id = $1
       GROUP BY u.id`, [userId]
    );

    const u = rows[0];
    const updated = {
      id: u.id, name: u.name, email: u.email, phone: u.phone,
      emailVerified: u.emailVerified ? new Date(u.emailVerified).toISOString() : null,
      isMasterAdmin: u.isMasterAdmin,
      isSupportTechnician: u.isSupportTechnician ?? false,
      isActive: u.isActive ?? true,
      createdAt: new Date(u.createdAt).toISOString(),
      _count: { leagueRoles: u.leagueRoles },
    };

    if (emailChanged) {
      sendVerificationEmail(updated.email, updated.name).catch(
        (e) => console.error("[ADMIN] re-verification email failed:", e)
      );
    }

    return NextResponse.json(updated);
  } finally {
    await pool.end();
  }
}
