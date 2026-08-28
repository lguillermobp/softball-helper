import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { loadDraftForAdmin } from "@/lib/draft";
import { DraftBoardView } from "@/components/league/DraftBoardView";

interface PageProps { params: Promise<{ slug: string; draftId: string }> }

export default async function DraftPage({ params }: PageProps) {
  const { slug, draftId } = await params;
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) redirect("/login");

  const r = await loadDraftForAdmin(slug, draftId, me.id, !!me.isMasterAdmin);
  if ("error" in r) {
    if (r.status === 404) notFound();
    redirect(`/league/${slug}`);
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--sh-bg-page)" }}>
      <header className="border-b sticky top-0 z-10" style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-header)" }}>
        <div className="mx-auto max-w-5xl px-4 py-3">
          <Link href={`/league/${slug}`} className="text-sm hover:opacity-80" style={{ color: "var(--sh-primary)" }}>← League</Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <DraftBoardView slug={slug} draftId={draftId} />
      </main>
    </div>
  );
}
