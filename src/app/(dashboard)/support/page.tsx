import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function SupportDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user as any;
  if (!user.isMasterAdmin && !user.isSupportTechnician) redirect("/dashboard");

  const tickets = await prisma.ticket.findMany({
    include: {
      league: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      assignedTo: { select: { id: true, name: true } },
      _count: { select: { messages: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const STATUS_COLORS: Record<string, string> = {
    OPEN:        "bg-blue-500/20 text-blue-300 border-blue-500/30",
    IN_PROGRESS: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    RESOLVED:    "bg-green-500/20 text-green-300 border-green-500/30",
    CLOSED:      "bg-gray-500/20 text-gray-400 border-gray-500/30",
  };
  const STATUS_LABEL: Record<string, string> = {
    OPEN: "Open", IN_PROGRESS: "In Progress", RESOLVED: "Resolved", CLOSED: "Closed",
  };
  const CAT_LABEL: Record<string, string> = {
    LEAGUE_ISSUE: "League Issue", SYSTEM_ISSUE: "System Issue",
  };

  const counts = {
    open:       tickets.filter(t => t.status === "OPEN").length,
    inProgress: tickets.filter(t => t.status === "IN_PROGRESS").length,
    resolved:   tickets.filter(t => t.status === "RESOLVED").length,
    closed:     tickets.filter(t => t.status === "CLOSED").length,
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--sh-bg-page)" }}>
      <header className="border-b sticky top-0 z-10" style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-header)" }}>
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center gap-3">
          <Link href="/dashboard" className="text-sm hover:opacity-80" style={{ color: "var(--sh-primary)" }}>← Dashboard</Link>
          <span style={{ color: "var(--sh-border2)" }}>|</span>
          <span className="font-semibold" style={{ color: "var(--sh-text)" }}>🎫 Support Dashboard</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Open",        value: counts.open,       color: "#60a5fa" },
            { label: "In Progress", value: counts.inProgress, color: "#facc15" },
            { label: "Resolved",    value: counts.resolved,   color: "#4ade80" },
            { label: "Closed",      value: counts.closed,     color: "#9ca3af" },
          ].map(s => (
            <div key={s.label} className="rounded-2xl border p-4 text-center" style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" }}>
              <p className="text-3xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs mt-1" style={{ color: "var(--sh-muted)" }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Ticket list */}
        {tickets.length === 0 ? (
          <div className="rounded-2xl border py-16 text-center text-sm" style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card)", color: "var(--sh-muted)" }}>
            No tickets yet.
          </div>
        ) : (
          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--sh-border)", background: "var(--sh-bg-card2)" }}>
                  {["Title", "Category", "League", "From", "Assigned", "Status", "Updated", ""].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--sh-muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tickets.map(t => (
                  <tr key={t.id} style={{ borderBottom: "1px solid var(--sh-border)" }}>
                    <td className="px-4 py-3 font-medium max-w-[200px] truncate" style={{ color: "var(--sh-text)" }}>{t.title}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--sh-muted)" }}>{CAT_LABEL[t.category]}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--sh-muted)" }}>{t.league?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--sh-muted)" }}>{t.createdBy.name ?? t.createdBy.email}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--sh-muted)" }}>{t.assignedTo?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${STATUS_COLORS[t.status]}`}>
                        {STATUS_LABEL[t.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--sh-muted)" }}>{new Date(t.updatedAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <Link href={`/support/tickets/${t.id}`}
                        className="text-xs font-semibold hover:opacity-80" style={{ color: "var(--sh-primary)" }}>
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
