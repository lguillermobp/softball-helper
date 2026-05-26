"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface Props { slug: string; teamId: string; teamName: string }

interface ParsedRow {
  name: string;
  email: string;
  jerseyNumber: string;
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

function parseCSV(text: string): ParsedRow[] {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];

  const firstCells = parseCSVLine(lines[0].toLowerCase());
  const hasHeader = firstCells.some((c) => c.includes("name") || c.includes("email"));
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines.filter((l) => l.trim()).map((line) => {
    const cells = parseCSVLine(line);
    const name        = cells[0] ?? "";
    const email       = cells[1] ?? "";
    const jerseyNumber = cells[2] ?? "";

    let error: string | undefined;
    if (!name)                    error = "Name required";
    else if (!email)              error = "Email required";
    else if (!EMAIL_RE.test(email)) error = "Invalid email";

    return { name, email, jerseyNumber, error };
  });
}

const SAMPLE = "name,email,jersey_number\nJane Smith,jane@example.com,7\nBob Jones,bob@example.com,\n";
const SAMPLE_HREF = `data:text/csv;charset=utf-8,${encodeURIComponent(SAMPLE)}`;

// ── Shared table styles ────────────────────────────────────────────────────────
const th = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider";
const tdBase = "px-3 py-2 text-sm";

export function UploadPlayersDialog({ slug, teamId, teamName }: Props) {
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
      const parsed = parseCSV(ev.target?.result as string);
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
          style={{ borderColor: "#2d5a2d", color: "#4ade80", background: "transparent" }}
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
              {i > 0 && <span style={{ color: "#374151" }}>›</span>}
              <span
                className="font-semibold capitalize"
                style={{ color: step === s ? "#4ade80" : "#6b7280" }}
              >
                {s === "select" ? "1. Select" : s === "preview" ? "2. Preview" : "3. Results"}
              </span>
            </span>
          ))}
        </div>

        {/* ── Step 1: Select ── */}
        {step === "select" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Upload a <code className="bg-gray-100 px-1 rounded">.csv</code> file with columns:{" "}
              <code className="bg-gray-100 px-1 rounded">name</code>,{" "}
              <code className="bg-gray-100 px-1 rounded">email</code>,{" "}
              <code className="bg-gray-100 px-1 rounded">jersey_number</code> (optional).
              The first row should be the header.
            </p>
            <a href={SAMPLE_HREF} download="players_template.csv"
              className="inline-flex items-center gap-1 text-xs underline font-medium"
              style={{ color: "#16a34a" }}>
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
                className="block w-full text-sm text-gray-700
                  file:mr-3 file:py-1.5 file:px-3 file:rounded file:border
                  file:border-gray-300 file:text-xs file:bg-white file:text-gray-700
                  hover:file:bg-gray-50"
              />
            </div>
            {fileErr && <p className="text-sm text-red-600">{fileErr}</p>}
            <div className="flex justify-end">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
            </div>
          </div>
        )}

        {/* ── Step 2: Preview ── */}
        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm">
              <span className="font-semibold" style={{ color: "#4ade80" }}>{validCount} valid</span>
              {invalidCount > 0 && (
                <span className="font-semibold text-red-500">{invalidCount} with errors — will be skipped</span>
              )}
            </div>

            <div className="rounded-lg border overflow-auto max-h-80" style={{ borderColor: "#1e3a1e" }}>
              <table className="w-full text-sm">
                <thead className="sticky top-0" style={{ background: "#0f2310" }}>
                  <tr style={{ borderBottom: "1px solid #1e3a1e" }}>
                    <th className={th} style={{ color: "#6b7280" }}>Name</th>
                    <th className={th} style={{ color: "#6b7280" }}>Email</th>
                    <th className={`${th} text-center w-14`} style={{ color: "#6b7280" }}>#</th>
                    <th className={`${th} text-center w-24`} style={{ color: "#6b7280" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} style={{
                      borderBottom: "1px solid #0f2310",
                      background: row.error ? "#1a0707" : "#0f2310",
                    }}>
                      <td className={tdBase} style={{ color: row.error ? "#f87171" : "#f0fdf4" }}>
                        {row.name || "—"}
                      </td>
                      <td className={`${tdBase} text-xs`} style={{ color: row.error ? "#f87171" : "#6b7280" }}>
                        {row.email || "—"}
                      </td>
                      <td className={`${tdBase} text-center text-xs`} style={{ color: "#4ade80" }}>
                        {row.jerseyNumber || "—"}
                      </td>
                      <td className={`${tdBase} text-center text-xs font-semibold`}>
                        {row.error
                          ? <span className="text-red-400">✗ {row.error}</span>
                          : <span style={{ color: "#4ade80" }}>✓ OK</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {fileErr && <p className="text-sm text-red-600">{fileErr}</p>}

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
              {addedCount  > 0 && <span className="font-semibold" style={{ color: "#4ade80" }}>✓ {addedCount} added</span>}
              {linkedCount > 0 && <span className="font-semibold" style={{ color: "#86efac" }}>✓ {linkedCount} linked</span>}
              {errorCount  > 0 && <span className="font-semibold text-red-500">✗ {errorCount} errors</span>}
            </div>

            <div className="rounded-lg border overflow-auto max-h-80" style={{ borderColor: "#1e3a1e" }}>
              <table className="w-full text-sm">
                <thead className="sticky top-0" style={{ background: "#0f2310" }}>
                  <tr style={{ borderBottom: "1px solid #1e3a1e" }}>
                    <th className={th} style={{ color: "#6b7280" }}>Name</th>
                    <th className={th} style={{ color: "#6b7280" }}>Email</th>
                    <th className={`${th} text-center w-28`} style={{ color: "#6b7280" }}>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #0f2310" }}>
                      <td className={`${tdBase} font-medium`} style={{ color: "#f0fdf4" }}>{r.name}</td>
                      <td className={`${tdBase} text-xs`} style={{ color: "#6b7280" }}>{r.email}</td>
                      <td className={`${tdBase} text-center text-xs font-semibold`}>
                        {r.status === "added"  && <span style={{ color: "#4ade80" }}>✓ Added</span>}
                        {r.status === "linked" && <span style={{ color: "#86efac" }}>✓ Linked</span>}
                        {r.status === "error"  && (
                          <span className="text-red-400" title={r.message}>✗ {r.message}</span>
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
