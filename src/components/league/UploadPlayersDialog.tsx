"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface Props { slug: string; teamId: string; teamName: string; requireDob?: boolean }

interface ParsedRow {
  name: string;
  email: string;
  jerseyNumber: string;
  dob: string;
  error?: string;
}

interface ResultRow {
  name: string;
  email: string;
  status: "added" | "linked" | "error";
  message?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseCSVLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQ = !inQ; }
    else if (ch === "," && !inQ) { cells.push(cur.trim()); cur = ""; }
    else { cur += ch; }
  }
  cells.push(cur.trim());
  return cells;
}

function parseCSV(text: string, requireDob = false): ParsedRow[] {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];

  const firstCells = parseCSVLine(lines[0].toLowerCase());
  const hasHeader = firstCells.some((c) => c.includes("name") || c.includes("email"));
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines.filter((l) => l.trim()).map((line) => {
    const cells = parseCSVLine(line);
    const name         = cells[0] ?? "";
    const email        = cells[1] ?? "";
    const jerseyNumber = cells[2] ?? "";
    const dob          = cells[3] ?? "";

    let error: string | undefined;
    if (!name)                               error = "Name required";
    else if (!email)                         error = "Email required";
    else if (!EMAIL_RE.test(email))          error = "Invalid email";
    else if (requireDob && !dob)             error = "DOB required (YYYY-MM-DD)";
    else if (dob && isNaN(Date.parse(dob)))  error = "Invalid date format (use YYYY-MM-DD)";

    return { name, email, jerseyNumber, dob, error };
  });
}

const SAMPLE = "name,email,jersey_number,dob\nJane Smith,jane@example.com,7,1995-06-09\nBob Jones,bob@example.com,,\n";
const SAMPLE_HREF = `data:text/csv;charset=utf-8,${encodeURIComponent(SAMPLE)}`;

const th = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider";
const tdBase = "px-3 py-2 text-sm";

export function UploadPlayersDialog({ slug, teamId, teamName, requireDob = false }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen]       = useState(false);
  const [step, setStep]       = useState<"select" | "preview" | "results">("select");
  const [rows, setRows]       = useState<ParsedRow[]>([]);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [fileErr, setFileErr] = useState("");

  function reset() {
    setStep("select"); setRows([]); setResults([]); setFileErr("");
    if (fileRef.current) fileRef.current.value = "";
  }
  function handleClose() { setOpen(false); reset(); }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileErr("");
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseCSV(ev.target?.result as string, requireDob);
      if (parsed.length === 0) { setFileErr("No data rows found."); return; }
      setRows(parsed);
      setStep("preview");
    };
    reader.readAsText(file);
  }

  async function handleUpload() {
    const valid = rows.filter((r) => !r.error);
    if (!valid.length) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/leagues/${slug}/players/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          players: valid.map((r) => ({
            name: r.name,
            email: r.email,
            jerseyNumber: r.jerseyNumber || null,
            dob: r.dob || null,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setFileErr(data.error ?? "Upload failed."); setStep("preview"); return; }
      setResults(data.results);
      setStep("results");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const validCount   = rows.filter((r) => !r.error).length;
  const invalidCount = rows.filter((r) =>  r.error).length;
  const addedCount   = results.filter((r) => r.status === "added").length;
  const linkedCount  = results.filter((r) => r.status === "linked").length;
  const errorCount   = results.filter((r) => r.status === "error").length;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true); }}>
      <DialogTrigger asChild>
        <button
          className="text-xs px-2 py-1 rounded-md border transition-colors hover:opacity-80"
          style={{ borderColor: "var(--sh-border2)", color: "var(--sh-primary)", background: "transparent" }}
        >
          ↑ CSV
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Players — {teamName}</DialogTitle>
        </DialogHeader>

        {/* ── Step indicator ── */}
        <div className="flex items-center gap-2 text-xs mb-2">
          {(["select", "preview", "results"] as const).map((s, i) => (
            <span key={s} className="flex items-center gap-2">
              {i > 0 && <span style={{ color: "var(--sh-muted)" }}>›</span>}
              <span
                className="font-semibold capitalize"
                style={{ color: step === s ? "var(--sh-primary)" : "var(--sh-muted)" }}
              >
                {s === "select" ? "1. Select" : s === "preview" ? "2. Preview" : "3. Results"}
              </span>
            </span>
          ))}
        </div>

        {/* ── Step 1: Select ── */}
        {step === "select" && (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: "var(--sh-muted)" }}>
              Upload a{" "}
              <code className="px-1 rounded text-xs font-mono" style={{ background: "var(--sh-bg-card2)", color: "var(--sh-primary)" }}>.csv</code>
              {" "}file with columns:{" "}
              <code className="px-1 rounded text-xs font-mono" style={{ background: "var(--sh-bg-card2)", color: "var(--sh-primary)" }}>name</code>,{" "}
              <code className="px-1 rounded text-xs font-mono" style={{ background: "var(--sh-bg-card2)", color: "var(--sh-primary)" }}>email</code>,{" "}
              <code className="px-1 rounded text-xs font-mono" style={{ background: "var(--sh-bg-card2)", color: "var(--sh-primary)" }}>jersey_number</code>{" "}
              (optional). The first row should be the header.
            </p>
            <a href={SAMPLE_HREF} download="players_template.csv"
              className="inline-flex items-center gap-1 text-xs underline font-medium"
              style={{ color: "var(--sh-primary)" }}>
              ↓ Download sample template
            </a>
            <div className="space-y-1">
              <Label htmlFor="csvFile">Select CSV file</Label>
              <input
                ref={fileRef}
                id="csvFile"
                type="file"
                accept=".csv,text/csv"
                onChange={onFileChange}
                className="block w-full text-sm"
              />
            </div>
            {fileErr && <p className="text-sm" style={{ color: "var(--sh-danger)" }}>{fileErr}</p>}
            <div className="flex justify-end">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
            </div>
          </div>
        )}

        {/* ── Step 2: Preview ── */}
        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm">
              <span className="font-semibold" style={{ color: "var(--sh-primary)" }}>{validCount} valid</span>
              {invalidCount > 0 && (
                <span className="font-semibold" style={{ color: "var(--sh-danger)" }}>{invalidCount} with errors — will be skipped</span>
              )}
            </div>

            <div className="rounded-lg border overflow-auto max-h-80" style={{ borderColor: "var(--sh-border)" }}>
              <table className="w-full text-sm">
                <thead className="sticky top-0" style={{ background: "var(--sh-bg-card2)" }}>
                  <tr style={{ borderBottom: "1px solid var(--sh-border)" }}>
                    <th className={th} style={{ color: "var(--sh-muted)" }}>Name</th>
                    <th className={th} style={{ color: "var(--sh-muted)" }}>Email</th>
                    <th className={`${th} text-center w-14`} style={{ color: "var(--sh-muted)" }}>#</th>
                    <th className={`${th} text-center w-24`} style={{ color: "var(--sh-muted)" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} style={{
                      borderBottom: "1px solid var(--sh-border)",
                      background: row.error ? "var(--sh-danger-bg)" : "transparent",
                    }}>
                      <td className={tdBase} style={{ color: row.error ? "var(--sh-danger)" : "var(--sh-text)" }}>
                        {row.name || "—"}
                      </td>
                      <td className={`${tdBase} text-xs`} style={{ color: row.error ? "var(--sh-danger)" : "var(--sh-muted)" }}>
                        {row.email || "—"}
                      </td>
                      <td className={`${tdBase} text-center text-xs`} style={{ color: "var(--sh-primary)" }}>
                        {row.jerseyNumber || "—"}
                      </td>
                      <td className={`${tdBase} text-center text-xs font-semibold`}>
                        {row.error
                          ? <span style={{ color: "var(--sh-danger)" }}>✗ {row.error}</span>
                          : <span style={{ color: "var(--sh-primary)" }}>✓ OK</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {fileErr && <p className="text-sm" style={{ color: "var(--sh-danger)" }}>{fileErr}</p>}

            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => { reset(); }}>← Back</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose}>Cancel</Button>
                <Button onClick={handleUpload} disabled={loading || validCount === 0}>
                  {loading ? "Uploading…" : `Upload ${validCount} player${validCount !== 1 ? "s" : ""}`}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: Results ── */}
        {step === "results" && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 text-sm">
              {addedCount  > 0 && <span className="font-semibold" style={{ color: "var(--sh-primary)" }}>✓ {addedCount} added</span>}
              {linkedCount > 0 && <span className="font-semibold" style={{ color: "var(--sh-secondary)" }}>✓ {linkedCount} linked</span>}
              {errorCount  > 0 && <span className="font-semibold" style={{ color: "var(--sh-danger)" }}>✗ {errorCount} errors</span>}
            </div>

            <div className="rounded-lg border overflow-auto max-h-80" style={{ borderColor: "var(--sh-border)" }}>
              <table className="w-full text-sm">
                <thead className="sticky top-0" style={{ background: "var(--sh-bg-card2)" }}>
                  <tr style={{ borderBottom: "1px solid var(--sh-border)" }}>
                    <th className={th} style={{ color: "var(--sh-muted)" }}>Name</th>
                    <th className={th} style={{ color: "var(--sh-muted)" }}>Email</th>
                    <th className={`${th} text-center w-28`} style={{ color: "var(--sh-muted)" }}>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--sh-border)" }}>
                      <td className={`${tdBase} font-medium`} style={{ color: "var(--sh-text)" }}>{r.name}</td>
                      <td className={`${tdBase} text-xs`} style={{ color: "var(--sh-muted)" }}>{r.email}</td>
                      <td className={`${tdBase} text-center text-xs font-semibold`}>
                        {r.status === "added"  && <span style={{ color: "var(--sh-primary)" }}>✓ Added</span>}
                        {r.status === "linked" && <span style={{ color: "var(--sh-secondary)" }}>✓ Linked</span>}
                        {r.status === "error"  && (
                          <span style={{ color: "var(--sh-danger)" }} title={r.message}>✗ {r.message}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleClose}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
