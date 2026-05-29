import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { Pool } from "pg";

interface Params { params: Promise<{ userId: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!(session?.user as any)?.isMasterAdmin)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId } = await params;
  const { password } = await req.json();

  if (!password || password.length < 8)
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });

  const dbUrl = process.env.DATABASE_URL || process.env.DATABASE_PRIVATE_URL ||
    process.env.DATABASE_PUBLIC_URL || process.env.POSTGRES_URL || "";
  const pool = new Pool({ connectionString: dbUrl, ssl: false });

  try {
    const { rows } = await pool.query(`SELECT id FROM users WHERE id = $1`, [userId]);
    if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const hashed = await bcrypt.hash(password, 12);
    await pool.query(`UPDATE users SET password = $1 WHERE id = $2`, [hashed, userId]);

    return NextResponse.json({ success: true });
  } finally {
    await pool.end();
  }
}
