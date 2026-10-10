import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ClubsView } from "@/components/clubs/ClubsView";

export default async function ClubsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return <ClubsView />;
}
