import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit, getRequestMeta } from "@/lib/audit";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

interface Params { params: Promise<{ slug: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const userId        = session.user.id!;
  const isMasterAdmin = (session.user as any).isMasterAdmin;

  const league = await prisma.league.findUnique({
    where: { slug },
    include: { userRoles: { where: { userId } } },
  });
  if (!league) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isLeagueAdmin = isMasterAdmin || league.userRoles.some((r) => r.role === "LEAGUE_ADMIN");
  if (!isLeagueAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { dataUrl } = await req.json() as { dataUrl: string };
  if (!dataUrl?.startsWith("data:image/"))
    return NextResponse.json({ error: "Invalid image data" }, { status: 400 });

  const result = await cloudinary.uploader.upload(dataUrl, {
    folder:         `softball-helper/${league.id}/league`,
    public_id:      "banner",
    overwrite:      true,
    transformation: [{ width: 1600, height: 300, crop: "fill", gravity: "auto" }],
    format:         "jpg",
  });

  await prisma.league.update({ where: { id: league.id }, data: { bannerUrl: result.secure_url } });
  await logAudit({ actor: session.user as any, action: "league.banner.upload", leagueId: league.id, leagueName: league.name, ...getRequestMeta(req) });

  return NextResponse.json({ bannerUrl: result.secure_url });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const userId        = session.user.id!;
  const isMasterAdmin = (session.user as any).isMasterAdmin;

  const league = await prisma.league.findUnique({
    where: { slug },
    include: { userRoles: { where: { userId } } },
  });
  if (!league) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isLeagueAdmin = isMasterAdmin || league.userRoles.some((r) => r.role === "LEAGUE_ADMIN");
  if (!isLeagueAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.league.update({ where: { id: league.id }, data: { bannerUrl: null } });

  return NextResponse.json({ success: true });
}
