import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { loadOwnedClub } from "@/lib/club";
import { linkClubPlayers } from "@/lib/club-linking";

interface Params { params: Promise<{ clubId: string }> }

// Link every not-yet-linked player in the club into a profile (auto-link or new).
export async function POST(_: NextRequest, { params }: Params) {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { clubId } = await params;
  const club = await loadOwnedClub(clubId, me.id, !!me.isMasterAdmin);
  if (!club) return NextResponse.json({ error: "Club not found" }, { status: 404 });

  const result = await linkClubPlayers(clubId);
  return NextResponse.json(result);
}
