"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface AuditEntry {
  id: string;
  action: string;
  entityType: string | null;
  leagueName: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface Props {
  userId: string;
  userName: string | null;
  userEmail: string;
}

const ACTION_COLORS: Record<string, { bg: string; color: string }> = {
  "player.create":        { bg: "#14532d", color: "#4ade80" },
  "player.update":        { bg: "#1e3a5f", color: "#93c5fd" },
  "player.invite.resend": { bg: "#1e3a5f", color: "#93c5fd" },
  "team.create":          { bg: "#14532d", color: "#4ade80" },
  "team.update":          { bg: "#1e3a5f", color: "#93c5fd" },
  "team.delete":          { bg: "#450a0a", color: "#f87171" },
  "team.logo.upload":     { bg: "#1e3a5f", color: "#93c5fd" },
  "member.add":           { bg: "#14532d", color: "#4ade80" },
  "user.password.change": { bg: "#451a03", color: "#fbbf24" },
  "broadcast.send":       { bg: "#1a1a3d", color: "#a78bfa" },
};

function ActionBadge({ action }: { action: string }) {
  const style = ACTION_COLORS[action] ?? { bg: "#1f2937", color: "#9ca3af" };
  return (
    <span className="text-xs font-semibold rounded-full px-2.5 py-0.5 whitespace-nowrap"
      style={{ background: style.bg, color: style.color }}>
      {action}
    </span>
  );
}

function metaSummary(meta: Record<string, unknown> | null): string {
  if (!meta) return "";
  const parts: string[] = [];
  if (meta.name)           parts.push(`${meta.name}`);
  if (meta.teamName)       parts.push(`team: ${meta.teamName}`);
  if (meta.playerName)     parts.push(`player: ${meta.playerName}`);
  if (meta.role)           parts.push(`role: ${meta.role}`);
  if (meta.recipientCount) parts.push(`recipients: ${meta.recipientCount}`);
  if (meta.sent !== undefined) parts.push(`sent: ${meta.sent}`);
  return parts.join(" · ");
}

const dim  = { color: "var(--sh-muted)" };
const head = { color: "var(--sh-text)" };

export function UserAuditDialog({ userId, userName, userEmail }: Props) {
  const [open, setOpen]     = useState(false);
  const [logs, setLogs]     = useState<AuditEntry[]>([]);
  const [total, setTotal]   = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/admin/audit?userId=${userId}&page=1`)
      .then((r) => r.json())
      .then((data) => {
        setLogs(data.logs ?? []);
        setTotal(data.total ?? 0);
      })
      .finally(() => setLoading(false));
  }, [open, userId]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="text-xs px-2 py-1 rounded-md border hover:opacity-80"
          style={{ borderColor: "var(--sh-border2)", color: "var(--sh-purple)", background: "transparent" }}
          title="View audit log"
        >
          Audit
        </button>
      </DialogTrigger>

      <DialogContent style={{ maxWidth: 640 }}>
        <DialogHeader>
          <DialogTitle style={{ color: "var(--sh-text)" }}>
            Audit log — {userName ?? userEmail}
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs mb-3" style={dim}>
          {loading ? "Loading…" : `${total} event${total !== 1 ? "s" : ""} recorded`}
        </p>

        {!loading && logs.length === 0 ? (
          <p className="text-sm py-6 text-center" style={dim}>No audit events found for this user.</p>
        ) : (
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--sh-border)", maxHeight: 460, overflowY: "auto" }}>
            <table className="w-full text-sm">
              <thead className="sticky top-0" style={{ background: "var(--sh-bg-card2)" }}>
                <tr style={{ borderBottom: "1px solid var(--sh-border)" }}>
                  {["Time", "Action", "League", "Details"].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={dim}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const d = new Date(log.createdAt);
                  const summary = metaSummary(log.metadata);
                  return (
                    <tr key={log.id} style={{ borderBottom: "1px solid var(--sh-border)", background: "var(--sh-bg-card)" }}>
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap" style={dim}>
                        <p>{d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p>
                        <p>{d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</p>
                      </td>
                      <td className="px-3 py-2.5">
                        <ActionBadge action={log.action} />
                      </td>
                      <td className="px-3 py-2.5 text-xs" style={head}>{log.leagueName ?? "—"}</td>
                      <td className="px-3 py-2.5 text-xs max-w-xs truncate" style={dim} title={JSON.stringify(log.metadata)}>
                        {summary || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {total > 100 && (
          <p className="text-xs text-center mt-2" style={dim}>
            Showing first 100 events · <a href={`/admin/audit`} className="underline" style={{ color: "var(--sh-primary)" }}>View full log</a>
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
