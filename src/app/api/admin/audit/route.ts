import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!(session?.user as any)?.isMasterAdmin)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const page    = Math.max(1, parseInt(searchParams.get("page")    ?? "1", 10));
  const query   = searchParams.get("q")      ?? "";
  const action  = searchParams.get("action") ?? "";
  const from    = searchParams.get("from")   ?? "";
  const to      = searchParams.get("to")     ?? "";
  const PAGE    = 50;

  const where: Prisma.AuditLogWhereInput = {
    ...(query  && { OR: [
      { userName:  { contains: query, mode: Prisma.QueryMode.insensitive } },
      { userEmail: { contains: query, mode: Prisma.QueryMode.insensitive } },
      { leagueName:{ contains: query, mode: Prisma.QueryMode.insensitive } },
    ]}),
    ...(action && { action: { contains: action, mode: Prisma.QueryMode.insensitive } }),
    ...(from || to ? { createdAt: {
      ...(from && { gte: new Date(from) }),
      ...(to   && { lte: new Date(to + "T23:59:59Z") }),
    }} : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE,
      take: PAGE,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return NextResponse.json({ logs, total, page, pages: Math.ceil(total / PAGE) });
}
