import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { loadTryoutForAdmin } from "@/lib/tryout";
import { TryoutSetupView } from "@/components/league/TryoutSetupView";

interface PageProps { params: Promise<{ slug: string; tryoutId: string }> }

export default async function TryoutPage({ params }: PageProps) {
  const { slug, tryoutId } = await params;
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) redirect("/login");

  const r = await loadTryoutForAdmin(slug, tryoutId, me.id, !!me.isMasterAdmin);
  if ("error" in r) {
    if (r.status === 404) notFound();
    redirect(`/league/${slug}`);
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--sh-bg-page)" }}>
      <header className="border-b sticky top-0 z-10" style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-header)" }}>
        <div className="mx-auto max-w-4xl px-4 py-3">
          <Link href={`/league/${slug}`} className="text-sm flex items-center gap-1 hover:opacity-80" style={{ color: "var(--sh-primary)" }}>
            ← League
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">
        <TryoutSetupView slug={slug} tryoutId={tryoutId} />
      </main>
    </div>
  );
}
