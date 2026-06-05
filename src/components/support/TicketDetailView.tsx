"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const STATUS_COLORS: Record<string, string> = {
  OPEN:        "bg-blue-500/20 text-blue-300 border-blue-500/30",
  IN_PROGRESS: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  RESOLVED:    "bg-green-500/20 text-green-300 border-green-500/30",
  CLOSED:      "bg-gray-500/20 text-gray-400 border-gray-500/30",
};
const STATUS_OPTIONS = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
const STATUS_LABEL: Record<string, string> = {
  OPEN: "Open", IN_PROGRESS: "In Progress", RESOLVED: "Resolved", CLOSED: "Closed",
};
const CAT_LABEL: Record<string, string> = {
  LEAGUE_ISSUE: "League Issue", SYSTEM_ISSUE: "System Issue",
};

interface Author {
  id: string; name: string | null; email: string;
  isSupportTechnician: boolean; isMasterAdmin: boolean;
}
interface Message { id: string; body: string; createdAt: string; author: Author }
interface Ticket {
  id: string; title: string; body: string;
  category: string; status: string;
  createdAt: string; updatedAt: string;
  league: { id: string; name: string } | null;
  createdBy: { id: string; name: string | null; email: string };
  assignedTo: { id: string; name: string | null; email: string } | null;
  messages: Message[];
}
interface Technician { id: string; name: string | null; email: string; isMasterAdmin?: boolean }

interface Props {
  ticket: Ticket;
  currentUserId: string;
  isMasterAdmin: boolean;
  isSupportTechnician: boolean;
  technicians: Technician[];
  backHref: string;
}

export function TicketDetailView({ ticket: initial, currentUserId, isMasterAdmin, isSupportTechnician, technicians, backHref }: Props) {
  const router = useRouter();
  const [ticket, setTicket] = useState(initial);
  const [reply, setReply]   = useState("");
  const [sending, setSending] = useState(false);
  const [replyError, setReplyError] = useState("");

  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [transferId, setTransferId]         = useState(ticket.assignedTo?.id ?? "");

  const isStaff  = isMasterAdmin || isSupportTechnician;
  const isClosed = ticket.status === "CLOSED";

  async function patch(body: object) {
    const res = await fetch(`/api/support/tickets/${ticket.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const updated = await res.json();
      setTicket(t => ({ ...t, status: updated.status, assignedToId: updated.assignedToId }));
      router.refresh();
    }
  }

  async function handleStatusChange(status: string) {
    setUpdatingStatus(true);
    await patch({ status });
    setUpdatingStatus(false);
  }

  async function handleTransfer() {
    if (!transferId) return;
    await patch({ assignedToId: transferId });
  }

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true); setReplyError("");
    const res = await fetch(`/api/support/tickets/${ticket.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: reply.trim() }),
    });
    setSending(false);
    if (!res.ok) {
      const d = await res.json();
      setReplyError(d.error ?? "Failed to send reply");
      return;
    }
    const msg = await res.json();
    setTicket(t => ({ ...t, messages: [...t.messages, msg], status: t.status === "OPEN" && isStaff ? "IN_PROGRESS" : t.status }));
    setReply("");
  }

  const inputStyle = { borderColor: "var(--sh-border)", background: "var(--sh-bg-card2)", color: "var(--sh-text)" };

  return (
    <div className="min-h-screen" style={{ background: "var(--sh-bg-page)" }}>
      <header className="border-b sticky top-0 z-10" style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-header)" }}>
        <div className="mx-auto max-w-4xl px-4 py-3 flex items-center gap-3">
          <Link href={backHref} className="text-sm hover:opacity-80" style={{ color: "var(--sh-primary)" }}>←</Link>
          <span className="font-semibold truncate" style={{ color: "var(--sh-text)" }}>{ticket.title}</span>
          <span className={`ml-auto shrink-0 text-xs px-2.5 py-1 rounded-full border font-semibold ${STATUS_COLORS[ticket.status]}`}>
            {STATUS_LABEL[ticket.status]}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 space-y-6">

        {/* Meta card */}
        <div className="rounded-2xl border p-5" style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" }}>
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "var(--sh-primary)" }}>Category</p>
              <p style={{ color: "var(--sh-text)" }}>{CAT_LABEL[ticket.category]}</p>
            </div>
            {ticket.league && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "var(--sh-primary)" }}>League</p>
                <p style={{ color: "var(--sh-text)" }}>{ticket.league.name}</p>
              </div>
            )}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "var(--sh-primary)" }}>Opened by</p>
              <p style={{ color: "var(--sh-text)" }}>{ticket.createdBy.name ?? ticket.createdBy.email}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "var(--sh-primary)" }}>Assigned to</p>
              <p style={{ color: "var(--sh-text)" }}>{ticket.assignedTo?.name ?? ticket.assignedTo?.email ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "var(--sh-primary)" }}>Created</p>
              <p style={{ color: "var(--sh-text)" }}>{new Date(ticket.createdAt).toLocaleString()}</p>
            </div>
          </div>

          {/* Staff controls */}
          {isStaff && (
            <div className="mt-5 pt-5 border-t flex flex-wrap gap-4" style={{ borderColor: "var(--sh-border)" }}>
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--sh-primary)" }}>Status</label>
                <select
                  value={ticket.status}
                  onChange={e => handleStatusChange(e.target.value)}
                  disabled={updatingStatus}
                  className="px-2 py-1 rounded-lg border text-sm focus:outline-none"
                  style={inputStyle}
                >
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
              </div>

              {isMasterAdmin && (
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--sh-primary)" }}>Transfer to</label>
                  <select
                    value={transferId}
                    onChange={e => setTransferId(e.target.value)}
                    className="px-2 py-1 rounded-lg border text-sm focus:outline-none"
                    style={inputStyle}
                  >
                    <option value="">— Select technician —</option>
                    {technicians.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name ?? t.email}{t.isMasterAdmin ? " (Admin)" : ""}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleTransfer}
                    disabled={!transferId || transferId === ticket.assignedTo?.id}
                    className="px-3 py-1 rounded-lg text-sm font-semibold disabled:opacity-40"
                    style={{ background: "var(--sh-bg-card2)", color: "var(--sh-secondary)", border: "1px solid var(--sh-border2)" }}
                  >
                    Transfer
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Thread */}
        <div className="space-y-4">
          {/* Original message */}
          <MessageBubble
            authorName={ticket.createdBy.name ?? ticket.createdBy.email}
            body={ticket.body}
            date={ticket.createdAt}
            isStaff={false}
            isSelf={ticket.createdBy.id === currentUserId}
          />
          {ticket.messages.map(msg => (
            <MessageBubble
              key={msg.id}
              authorName={msg.author.name ?? msg.author.email}
              body={msg.body}
              date={msg.createdAt}
              isStaff={msg.author.isSupportTechnician || msg.author.isMasterAdmin}
              isSelf={msg.author.id === currentUserId}
            />
          ))}
        </div>

        {/* Reply box */}
        {!isClosed ? (
          <form onSubmit={handleReply} className="rounded-2xl border p-5 space-y-3" style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" }}>
            <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: "var(--sh-primary)" }}>Reply</label>
            <textarea
              required rows={4}
              className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              style={{ ...inputStyle, resize: "vertical" }}
              placeholder="Write your reply…"
              value={reply}
              onChange={e => setReply(e.target.value)}
            />
            {replyError && <p className="text-sm" style={{ color: "var(--sh-danger)" }}>{replyError}</p>}
            <div className="flex justify-end">
              <button type="submit" disabled={sending || !reply.trim()}
                className="px-5 py-2 rounded-lg font-semibold text-sm disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#16a34a,#15803d)", color: "#fff" }}>
                {sending ? "Sending…" : "Send Reply"}
              </button>
            </div>
          </form>
        ) : (
          <div className="text-center py-6 rounded-2xl border text-sm" style={{ borderColor: "var(--sh-border)", color: "var(--sh-muted)" }}>
            This ticket is closed.
          </div>
        )}
      </main>
    </div>
  );
}

function MessageBubble({ authorName, body, date, isStaff, isSelf }: {
  authorName: string; body: string; date: string; isStaff: boolean; isSelf: boolean;
}) {
  return (
    <div className={`flex ${isSelf ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] rounded-2xl border p-4 space-y-1 ${isSelf ? "rounded-tr-sm" : "rounded-tl-sm"}`}
        style={{
          borderColor: isStaff ? "var(--sh-primary)" : "var(--sh-border)",
          background: isStaff ? "var(--sh-accent-bg)" : "var(--sh-bg-card)",
        }}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold" style={{ color: isStaff ? "var(--sh-primary)" : "var(--sh-secondary)" }}>
            {authorName}{isStaff ? " · Support" : ""}
          </span>
          <span className="text-xs" style={{ color: "var(--sh-muted)" }}>
            {new Date(date).toLocaleString()}
          </span>
        </div>
        <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--sh-text)" }}>{body}</p>
      </div>
    </div>
  );
}
