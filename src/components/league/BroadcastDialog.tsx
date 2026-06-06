"use client";

import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Recipient {
  key: string;       // unique key (email + role)
  email: string;
  name: string | null;
  teamName: string;
  role: "Manager" | "Assistant";
}

interface Season { id: string; name: string }
interface Condition { id: string }

interface Props {
  slug: string;
  teams: {
    id: string;
    name: string;
    manager: { id: string; name: string | null; email: string } | null;
    assistant: { id: string; name: string | null; email: string } | null;
  }[];
  seasons: Season[];
  hasConditions: boolean;
}

export function BroadcastDialog({ slug, teams, seasons, hasConditions }: Props) {
  const [open, setOpen]           = useState(false);
  const [sending, setSending]     = useState(false);
  const [result, setResult]       = useState<{ sent: number; failed: number } | null>(null);
  const [error, setError]         = useState("");

  // Content flags
  const [inclRoster,     setInclRoster]     = useState(true);
  const [inclConditions, setInclConditions] = useState(hasConditions);
  const [inclSchedule,   setInclSchedule]   = useState(seasons.length > 0);
  const [seasonId,       setSeasonId]       = useState(seasons[0]?.id ?? "");

  // Build deduplicated recipient list from all teams
  const allRecipients = useMemo<Recipient[]>(() => {
    const seen = new Set<string>();
    const list: Recipient[] = [];
    for (const t of teams) {
      if (t.manager?.email && !seen.has(t.manager.email)) {
        seen.add(t.manager.email);
        list.push({ key: t.manager.email + "_mgr", email: t.manager.email, name: t.manager.name, teamName: t.name, role: "Manager" });
      }
      if (t.assistant?.email && !seen.has(t.assistant.email)) {
        seen.add(t.assistant.email);
        list.push({ key: t.assistant.email + "_asst", email: t.assistant.email, name: t.assistant.name, teamName: t.name, role: "Assistant" });
      }
    }
    return list;
  }, [teams]);

  const [selected, setSelected] = useState<Set<string>>(() => new Set(allRecipients.map((r) => r.key)));

  const allSelected = selected.size === allRecipients.length && allRecipients.length > 0;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(allRecipients.map((r) => r.key)));
  }

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function handleOpen(v: boolean) {
    setOpen(v);
    if (v) {
      setResult(null);
      setError("");
      setSelected(new Set(allRecipients.map((r) => r.key)));
    }
  }

  async function handleSend() {
    if (selected.size === 0) { setError("Select at least one recipient."); return; }
    if (!inclRoster && !inclConditions && !inclSchedule) { setError("Select at least one content type."); return; }
    setError("");
    setSending(true);

    const recipients = allRecipients.filter((r) => selected.has(r.key)).map((r) => ({
      email: r.email, name: r.name, teamName: r.teamName,
    }));

    const res = await fetch(`/api/leagues/${slug}/broadcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipients,
        includeRoster:     inclRoster,
        includeConditions: inclConditions,
        includeSchedule:   inclSchedule,
        seasonId:          inclSchedule ? seasonId : null,
      }),
    });

    setSending(false);
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Something went wrong"); return; }
    setResult(data);
  }

  const canSend = selected.size > 0 && (inclRoster || inclConditions || inclSchedule);

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" style={{ borderColor: "var(--sh-border2)", color: "var(--sh-primary)" }}>
          📧 Send to managers
        </Button>
      </DialogTrigger>

      <DialogContent style={{ maxWidth: 520 }}>
        <DialogHeader>
          <DialogTitle>Send to managers</DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="space-y-4 py-2">
            <div className="rounded-xl border p-4 text-center space-y-1"
              style={{ borderColor: "var(--sh-primary)", background: "var(--sh-approved-bg)" }}>
              <p className="text-2xl font-bold" style={{ color: "var(--sh-primary)" }}>✓ Sent</p>
              <p className="text-sm" style={{ color: "var(--sh-secondary)" }}>
                {result.sent} email{result.sent !== 1 ? "s" : ""} sent successfully
                {result.failed > 0 && ` · ${result.failed} failed`}
              </p>
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5 py-1">

            {/* Recipients */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold" style={{ color: "var(--sh-text)" }}>
                  Recipients
                </p>
                {allRecipients.length > 0 && (
                  <button onClick={toggleAll} className="text-xs hover:underline" style={{ color: "var(--sh-primary)" }}>
                    {allSelected ? "Deselect all" : "Select all"}
                  </button>
                )}
              </div>

              {allRecipients.length === 0 ? (
                <p className="text-xs rounded-xl border px-4 py-3" style={{ borderColor: "var(--sh-border)", color: "var(--sh-muted)" }}>
                  No managers or assistants found. Add staff to your teams first.
                </p>
              ) : (
                <div className="rounded-xl border overflow-hidden grid grid-cols-2" style={{ borderColor: "var(--sh-border)" }}>
                  {allRecipients.map((r) => (
                    <label key={r.key}
                      title={r.email}
                      className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:opacity-80 border-b"
                      style={{
                        background: selected.has(r.key) ? "var(--sh-approved-bg)" : "var(--sh-bg-card)",
                        borderColor: "var(--sh-border)",
                      }}>
                      <input
                        type="checkbox"
                        checked={selected.has(r.key)}
                        onChange={() => toggle(r.key)}
                        className="accent-green-500 w-4 h-4 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color: "var(--sh-text)" }}>
                          {r.name ?? r.email}
                        </p>
                        <p className="text-xs truncate" style={{ color: "var(--sh-muted)" }}>
                          {r.teamName} · {r.role}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
              {selected.size > 0 && (
                <p className="text-xs" style={{ color: "var(--sh-muted)" }}>
                  {selected.size} of {allRecipients.length} selected
                </p>
              )}
            </div>

            {/* Content */}
            <div className="space-y-2">
              <p className="text-sm font-semibold" style={{ color: "var(--sh-text)" }}>Include in email</p>
              <div className="rounded-xl border divide-y overflow-hidden" style={{ borderColor: "var(--sh-border)" }}>

                <label className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:opacity-80"
                  style={{ background: "var(--sh-bg-card)" }}>
                  <input type="checkbox" checked={inclRoster} onChange={(e) => setInclRoster(e.target.checked)}
                    className="accent-green-500 w-4 h-4 shrink-0" />
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--sh-text)" }}>Team roster</p>
                    <p className="text-xs" style={{ color: "var(--sh-muted)" }}>Player names and jersey numbers</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:opacity-80"
                  style={{ background: "var(--sh-bg-card)", opacity: hasConditions ? 1 : 0.5 }}>
                  <input type="checkbox" checked={inclConditions} disabled={!hasConditions}
                    onChange={(e) => setInclConditions(e.target.checked)}
                    className="accent-green-500 w-4 h-4 shrink-0" />
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--sh-text)" }}>Conditions</p>
                    <p className="text-xs" style={{ color: "var(--sh-muted)" }}>
                      {hasConditions ? "League rules and conditions" : "No conditions added yet"}
                    </p>
                  </div>
                </label>

                <div className="px-4 py-3" style={{ background: "var(--sh-bg-card)", opacity: seasons.length > 0 ? 1 : 0.5 }}>
                  <label className="flex items-center gap-3 cursor-pointer hover:opacity-80">
                    <input type="checkbox" checked={inclSchedule} disabled={seasons.length === 0}
                      onChange={(e) => setInclSchedule(e.target.checked)}
                      className="accent-green-500 w-4 h-4 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium" style={{ color: "var(--sh-text)" }}>Schedule</p>
                      <p className="text-xs" style={{ color: "var(--sh-muted)" }}>
                        {seasons.length === 0 ? "No seasons available" : "Full season schedule for the team"}
                      </p>
                    </div>
                  </label>
                  {inclSchedule && seasons.length > 0 && (
                    <div className="mt-2 ml-7">
                      <select
                        value={seasonId}
                        onChange={(e) => setSeasonId(e.target.value)}
                        className="w-full rounded-lg border px-3 py-1.5 text-sm outline-none"
                        style={{ background: "var(--sh-bg-card2)", borderColor: "var(--sh-border)", color: "var(--sh-text)" }}
                      >
                        {seasons.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

              </div>
            </div>

            {error && <p className="text-sm" style={{ color: "var(--sh-danger)" }}>{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleSend} disabled={sending || !canSend}
                style={{ background: "linear-gradient(135deg,#16a34a,#15803d)", color: "#fff" }}>
                {sending
                  ? "Sending…"
                  : `Send to ${selected.size} recipient${selected.size !== 1 ? "s" : ""}`}
              </Button>
            </div>

          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
