import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ClubRosterView } from "@/components/clubs/ClubRosterView";

interface Props { params: Promise<{ clubId: string }> }

export default async function ClubRosterPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { clubId } = await params;
  return <ClubRosterView clubId={clubId} />;
}
