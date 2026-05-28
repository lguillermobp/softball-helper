import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

interface Params { params: Promise<{ slug: string; id: string }> }

const INCLUDE = {
  createdBy: { select: { id: true, name: true, email: true } },
} as const;

async function getAdminLeague(slug: string, userId: string, isMasterAdmin: boolean) {
  const league = await prisma.league.findUnique({
    where: { slug },
    include: { userRoles: { where: { userId } } },
  });
  if (!league) return null;
  const isAdmin = isMasterAdmin || league.userRoles.some(r => r.role === "LEAGUE_ADMIN");
  return isAdmin ? league : null;
}

// PATCH — admin only
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, id } = await params;
  const isMasterAdmin = (session.user as any).isMasterAdmin;
  const league = await getAdminLeague(slug, session.user.id!, isMasterAdmin);
  if (!league) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.condition.findFirst({ where: { id, leagueId: league.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { title, content, fileDataUrl, fileName, fileType, removeFile } = await req.json() as {
    title?: string;
    content?: string;
    fileDataUrl?: string;
    fileName?: string;
    fileType?: string;
    removeFile?: boolean;
  };

  let uploadedUrl = existing.fileUrl;
  let storedFileName = existing.fileName;
  let storedFileType = existing.fileType;

  if (removeFile) {
    uploadedUrl = null;
    storedFileName = null;
    storedFileType = null;
  }

  if (fileDataUrl) {
    const MAX_BYTES = 10 * 1024 * 1024;
    if (fileDataUrl.length > MAX_BYTES * 1.4)
      return NextResponse.json({ error: "File exceeds 10 MB limit" }, { status: 413 });

    const result = await cloudinary.uploader.upload(fileDataUrl, {
      folder:        `softball-helper/${league.id}/conditions`,
      resource_type: "auto",
      use_filename:  false,
    });
    uploadedUrl    = result.secure_url;
    storedFileName = fileName ?? null;
    storedFileType = fileType ?? null;
  }

  const updated = await prisma.condition.update({
    where: { id },
    data: {
      title:    title?.trim() ?? existing.title,
      content:  content !== undefined ? (content.trim() || null) : existing.content,
      fileUrl:  uploadedUrl,
      fileName: storedFileName,
      fileType: storedFileType,
    },
    include: INCLUDE,
  });

  return NextResponse.json(updated);
}

// DELETE — admin only
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, id } = await params;
  const isMasterAdmin = (session.user as any).isMasterAdmin;
  const league = await getAdminLeague(slug, session.user.id!, isMasterAdmin);
  if (!league) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.condition.findFirst({ where: { id, leagueId: league.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.condition.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
