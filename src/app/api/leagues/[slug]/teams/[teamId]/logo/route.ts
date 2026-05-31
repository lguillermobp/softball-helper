import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

interface Params { params: Promise<{ slug: string; teamId: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, teamId } = await params;
  const userId      = session.user.id!;
  const isMasterAdmin = (session.user as any).isMasterAdmin;

  const league = await prisma.league.findUnique({
    where: { slug },
    include: { userRoles: { where: { userId } } },
  });
  if (!league) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isLeagueAdmin = isMasterAdmin || league.userRoles.some((r) => r.role === "LEAGUE_ADMIN");

  const team = await prisma.team.findFirst({ where: { id: teamId, leagueId: league.id } });
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  // Managers and assistants can always upload their own team logo
  const isStaff = team.managerId === userId || team.assistantId === userId;
  if (!isLeagueAdmin && !isStaff)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { dataUrl } = await req.json() as { dataUrl: string };
  if (!dataUrl?.startsWith("data:image/"))
    return NextResponse.json({ error: "Invalid image data" }, { status: 400 });

  const result = await cloudinary.uploader.upload(dataUrl, {
    folder:         `softball-helper/${league.id}/teams`,
    public_id:      teamId,
    overwrite:      true,
    transformation: [{ width: 400, height: 400, crop: "fill" }],
    format:         "png",
  });

  await prisma.team.update({ where: { id: teamId }, data: { logoUrl: result.secure_url } });
  logAudit({ actor: session.user as any, action: "team.logo.upload", entityType: "Team", entityId: teamId, leagueId: league.id, leagueName: league.name, metadata: { teamName: team.name } });

  return NextResponse.json({ logoUrl: result.secure_url });
}
