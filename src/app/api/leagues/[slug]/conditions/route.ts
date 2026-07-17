import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

interface Params { params: Promise<{ slug: string }> }

const INCLUDE = {
  createdBy: { select: { id: true, name: true, email: true } },
} as const;

// GET — any league member
export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const league = await prisma.league.findUnique({
    where: { slug },
    include: { userRoles: { where: { userId: session.user.id! } } },
  });
  if (!league) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isMasterAdmin = (session.user as any).isMasterAdmin;
  if (!isMasterAdmin && league.userRoles.length === 0)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const conditions = await prisma.condition.findMany({
    where: { leagueId: league.id },
    include: INCLUDE,
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(conditions);
}

// POST — admin only; handles both text and file upload
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const userId = session.user.id!;

  const league = await prisma.league.findUnique({
    where: { slug },
    include: { userRoles: { where: { userId } } },
  });
  if (!league) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isMasterAdmin = (session.user as any).isMasterAdmin;
  const isAdmin = isMasterAdmin || league.userRoles.some(r => r.role === "LEAGUE_ADMIN");
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (league.status === "SUSPENDED") return NextResponse.json({ error: "This league is currently suspended." }, { status: 423 });

  const { title, content, fileDataUrl, fileName, fileType } = await req.json() as {
    title: string;
    content?: string;
    fileDataUrl?: string;
    fileName?: string;
    fileType?: string;
  };

  if (!title?.trim())
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  if (!content?.trim() && !fileDataUrl)
    return NextResponse.json({ error: "Content text or a file is required" }, { status: 400 });

  let uploadedUrl: string | null = null;

  if (fileDataUrl) {
    const MAX_BYTES = 10 * 1024 * 1024; // 10 MB base64 payload limit
    if (fileDataUrl.length > MAX_BYTES * 1.4)
      return NextResponse.json({ error: "File exceeds 10 MB limit" }, { status: 413 });

    const result = await cloudinary.uploader.upload(fileDataUrl, {
      folder:        `softball-helper/${league.id}/conditions`,
      resource_type: "auto",
      use_filename:  false,
    });
    uploadedUrl = result.secure_url;
  }

  // Count existing to append at end
  const count = await prisma.condition.count({ where: { leagueId: league.id } });

  const condition = await prisma.condition.create({
    data: {
      leagueId:    league.id,
      title:       title.trim(),
      content:     content?.trim() || null,
      fileUrl:     uploadedUrl,
      fileName:    fileName || null,
      fileType:    fileType || null,
      order:       count,
      createdById: userId,
    },
    include: INCLUDE,
  });

  return NextResponse.json(condition, { status: 201 });
}
