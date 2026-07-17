import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

interface Params { params: Promise<{ slug: string; playerId: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, playerId } = await params;

  const league = await prisma.league.findUnique({
    where: { slug },
    include: { userRoles: { where: { userId: session.user.id! } } },
  });
  if (!league) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (league.status === "SUSPENDED") return NextResponse.json({ error: "This league is currently suspended." }, { status: 423 });

  const userId = session.user.id!;
  const isMasterAdmin = (session.user as any).isMasterAdmin;
  const isLeagueAdmin = isMasterAdmin || league.userRoles.some((r) => r.role === "LEAGUE_ADMIN");

  const player = await prisma.player.findFirst({
    where: { id: playerId, leagueId: league.id },
    include: { team: { select: { status: true, managerId: true, assistantId: true } } },
  });
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  if (!isLeagueAdmin) {
    const isStaff =
      player.team.managerId === userId || player.team.assistantId === userId;
    if (!isStaff || player.team.status !== "PENDING")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { dataUrl } = await req.json() as { dataUrl: string };
  if (!dataUrl?.startsWith("data:image/")) {
    return NextResponse.json({ error: "Invalid image data" }, { status: 400 });
  }

  const result = await cloudinary.uploader.upload(dataUrl, {
    folder: `softball-helper/${league.id}/players`,
    public_id: playerId,
    overwrite: true,
    transformation: [{ width: 600, height: 600, crop: "fill", gravity: "face" }],
    format: "jpg",
  });

  await prisma.player.update({
    where: { id: playerId },
    data: { photoUrl: result.secure_url },
  });

  return NextResponse.json({ photoUrl: result.secure_url });
}
