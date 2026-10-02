"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface Season { id: string; name: string }
interface Cat { id: string; name: string }
interface Props { slug: string; seasons: Season[]; categories: Cat[]; defaultSeasonId: string; onDone: () => void }

interface ParsedRow {
  name: string; dob: string; email: string; phone: string;
  parent1Name: string; parent1Email: string; parent1Phone: string;
  parent2Name: string; parent2Email: string; parent2Phone: string;
  error?: string;
}
interface ResultRow { name: string; status: "added" | "error"; message?: string }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseCSVLine(line: string): string[] {
  const cells: string[] = [];
  let cur = ""; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQ = !inQ;
    else if (ch === "," && !inQ) { cells.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

// Map each canonical field to the accepted header names (normalized: lowercase, non-alphanumerics -> _).
const FIELD_ALIASES: Record<keyof Omit<ParsedRow, "error">, string[]> = {
  name:         ["name", "full_name", "player_name", "prospect_name"],
  dob:          ["dob", "date_of_birth", "birthdate", "birth_date"],
  email:        ["email", "player_email"],
  phone:        ["phone", "player_phone"],
  parent1Name:  ["parent1_name", "parent_1_name", "guardian1_name", "parent1"],
  parent1Email: ["parent1_email", "parent_1_email", "guardian1_email"],
  parent1Phone: ["parent1_phone", "parent_1_phone", "guardian1_phone"],
  parent2Name:  ["parent2_name", "parent_2_name", "guardian2_name", "parent2"],
  parent2Email: ["parent2_email", "parent_2_email", "guardian2_email"],
  parent2Phone: ["parent2_phone", "parent_2_phone", "guardian2_phone"],
};
const norm = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

function parseCSV(text: string): { rows: ParsedRow[]; headerError?: string } {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { rows: [] };

  const header = parseCSVLine(lines[0]).map(norm);
  const idx: Partial<Record<keyof Omit<ParsedRow, "error">, number>> = {};
  for (const field of Object.keys(FIELD_ALIASES) as (keyof Omit<ParsedRow, "error">)[]) {
    const col = header.findIndex((h) => FIELD_ALIASES[field].includes(h));
    if (col >= 0) idx[field] = col;
  }
  if (idx.name === undefined || idx.parent1Name === undefined)
    return { rows: [], headerError: "The first row must be a header containing at least 'name' and 'parent1_name' columns." };

  const get = (cells: string[], f: keyof Omit<ParsedRow, "error">) =>
    idx[f] !== undefined ? (cells[idx[f]!] ?? "") : "";

  const rows = lines.slice(1).filter((l) => l.trim()).map((line) => {
    const c = parseCSVLine(line);
    const row: ParsedRow = {
      name: get(c, "name"), dob: get(c, "dob"), email: get(c, "email"), phone: get(c, "phone"),
      parent1Name: get(c, "parent1Name"), parent1Email: get(c, "parent1Email"), parent1Phone: get(c, "parent1Phone"),
      parent2Name: get(c, "parent2Name"), parent2Email: get(c, "parent2Email"), parent2Phone: get(c, "parent2Phone"),
    };
    if (!row.name) row.error = "Name required";
    else if (!row.parent1Name) row.error = "Parent 1 name required";
    else if (row.dob && isNaN(Date.parse(row.dob))) row.error = "Invalid date (use YYYY-MM-DD)";
    else if (row.email && !EMAIL_RE.test(row.email)) row.error = "Invalid email";
    else if (row.parent1Email && !EMAIL_RE.test(row.parent1Email)) row.error = "Invalid parent 1 email";
    return row;
  });
  return { rows };
}

const SAMPLE = "name,dob,email,phone,parent1_name,parent1_email,parent1_phone,parent2_name,parent2_email,parent2_phone\n" +
  "Jane Smith,2014-06-09,,,John Smith,john@example.com,+1 555 100 2000,Mary Smith,mary@example.com,\n" +
  "Alex Lee,2013-11-02,,,Pat Lee,pat@example.com,,,,\n";
const SAMPLE_HREF = `data:text/csv;charset=utf-8,${encodeURIComponent(SAMPLE)}`;

const th = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider";
const tdBase = "px-3 py-2 text-sm";
const sel = "rounded-md border px-3 py-2 text-sm w-full";
const selStyle = { borderColor: "var(--sh-border)", background: "var(--sh-bg-card2)", color: "var(--sh-text)" };

export function UploadProspectsDialog({ slug, seasons, categories, defaultSeasonId, onDone }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"select" | "preview" | "results">("select");
  const [seasonId, setSeasonId] = useState(defaultSeasonId);
  const [categoryId, setCategoryId] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
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
      const { rows, headerError } = parseCSV(ev.target?.result as string);
      if (headerError) { setFileErr(headerError); return; }
      if (rows.length === 0) { setFileErr("No data rows found."); return; }
      setRows(rows);
      setStep("preview");
    };
    reader.readAsText(file);
  }

  async function handleUpload() {
    const valid = rows.filter((r) => !r.error);
    if (!valid.length || !categoryId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/leagues/${slug}/prospects/bulk`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seasonId, categoryId,
          prospects: valid.map((r) => ({
            name: r.name, dob: r.dob || null, email: r.email || null, phone: r.phone || null,
            parent1Name: r.parent1Name, parent1Email: r.parent1Email || null, parent1Phone: r.parent1Phone || null,
            parent2Name: r.parent2Name || null, parent2Email: r.parent2Email || null, parent2Phone: r.parent2Phone || null,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setFileErr(data.error ?? "Import failed."); setStep("preview"); return; }
      setResults(data.results);
      setStep("results");
      router.refresh();
      onDone();
    } finally {
      setLoading(false);
    }
  }

  const validCount = rows.filter((r) => !r.error).length;
  const invalidCount = rows.filter((r) => r.error).length;
  const addedCount = results.filter((r) => r.status === "added").length;
  const errorCount = results.filter((r) => r.status === "error").length;
  const catName = categories.find((c) => c.id === categoryId)?.name ?? "";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">↑ Import CSV</Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Import prospects from CSV</DialogTitle></DialogHeader>

        <div className="flex items-center gap-2 text-xs mb-2">
          {(["select", "preview", "results"] as const).map((s, i) => (
            <span key={s} className="flex items-center gap-2">
              {i > 0 && <span style={{ color: "var(--sh-muted)" }}>›</span>}
              <span className="font-semibold" style={{ color: step === s ? "var(--sh-primary)" : "var(--sh-muted)" }}>
                {s === "select" ? "1. Select" : s === "preview" ? "2. Preview" : "3. Results"}
              </span>
            </span>
          ))}
        </div>

        {step === "select" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="imp-season">Season *</Label>
                <select id="imp-season" className={sel} style={selStyle} value={seasonId} onChange={(e) => setSeasonId(e.target.value)}>
                  {seasons.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="imp-cat">Category / division *</Label>
                <select id="imp-cat" className={sel} style={selStyle} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">— Select category —</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <p className="text-sm" style={{ color: "var(--sh-muted)" }}>
              Every imported prospect goes into the selected season &amp; category. The CSV header row must include at least{" "}
              <code className="px-1 rounded text-xs font-mono" style={{ background: "var(--sh-bg-card2)", color: "var(--sh-primary)" }}>name</code> and{" "}
              <code className="px-1 rounded text-xs font-mono" style={{ background: "var(--sh-bg-card2)", color: "var(--sh-primary)" }}>parent1_name</code>.
              Optional columns: <span className="text-xs">dob (YYYY-MM-DD), email, phone, parent1_email, parent1_phone, parent2_name, parent2_email, parent2_phone</span>.
            </p>
            <a href={SAMPLE_HREF} download="prospects_template.csv"
              className="inline-flex items-center gap-1 text-xs underline font-medium" style={{ color: "var(--sh-primary)" }}>
              ↓ Download sample template
            </a>
            <div className="space-y-1">
              <Label htmlFor="pFile">Select CSV file</Label>
              <input ref={fileRef} id="pFile" type="file" accept=".csv,text/csv"
                disabled={!categoryId} onChange={onFileChange} className="block w-full text-sm disabled:opacity-50" />
              {!categoryId && <p className="text-xs" style={{ color: "var(--sh-muted)" }}>Select a category first.</p>}
            </div>
            {fileErr && <p className="text-sm" style={{ color: "var(--sh-danger)" }}>{fileErr}</p>}
            <div className="flex justify-end"><Button variant="outline" onClick={handleClose}>Cancel</Button></div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm flex-wrap">
              <span style={{ color: "var(--sh-muted)" }}>Into <b style={{ color: "var(--sh-text)" }}>{catName}</b></span>
              <span className="font-semibold" style={{ color: "var(--sh-primary)" }}>{validCount} valid</span>
              {invalidCount > 0 && <span className="font-semibold" style={{ color: "var(--sh-danger)" }}>{invalidCount} with errors — will be skipped</span>}
            </div>
            <div className="rounded-lg border overflow-auto max-h-80" style={{ borderColor: "var(--sh-border)" }}>
              <table className="w-full text-sm">
                <thead className="sticky top-0" style={{ background: "var(--sh-bg-card2)" }}>
                  <tr style={{ borderBottom: "1px solid var(--sh-border)" }}>
                    <th className={th} style={{ color: "var(--sh-muted)" }}>Name</th>
                    <th className={th} style={{ color: "var(--sh-muted)" }}>DOB</th>
                    <th className={th} style={{ color: "var(--sh-muted)" }}>Parent 1</th>
                    <th className={`${th} text-center w-28`} style={{ color: "var(--sh-muted)" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--sh-border)", background: row.error ? "var(--sh-danger-bg)" : "transparent" }}>
                      <td className={tdBase} style={{ color: row.error ? "var(--sh-danger)" : "var(--sh-text)" }}>{row.name || "—"}</td>
                      <td className={`${tdBase} text-xs`} style={{ color: "var(--sh-muted)" }}>{row.dob || "—"}</td>
                      <td className={`${tdBase} text-xs`} style={{ color: "var(--sh-muted)" }}>{row.parent1Name || "—"}</td>
                      <td className={`${tdBase} text-center text-xs font-semibold`}>
                        {row.error ? <span style={{ color: "var(--sh-danger)" }}>✗ {row.error}</span> : <span style={{ color: "var(--sh-primary)" }}>✓ OK</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {fileErr && <p className="text-sm" style={{ color: "var(--sh-danger)" }}>{fileErr}</p>}
            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={reset}>← Back</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose}>Cancel</Button>
                <Button onClick={handleUpload} disabled={loading || validCount === 0}>
                  {loading ? "Importing…" : `Import ${validCount} prospect${validCount !== 1 ? "s" : ""}`}
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === "results" && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 text-sm">
              {addedCount > 0 && <span className="font-semibold" style={{ color: "var(--sh-primary)" }}>✓ {addedCount} imported</span>}
              {errorCount > 0 && <span className="font-semibold" style={{ color: "var(--sh-danger)" }}>✗ {errorCount} errors</span>}
            </div>
            <div className="rounded-lg border overflow-auto max-h-80" style={{ borderColor: "var(--sh-border)" }}>
              <table className="w-full text-sm">
                <thead className="sticky top-0" style={{ background: "var(--sh-bg-card2)" }}>
                  <tr style={{ borderBottom: "1px solid var(--sh-border)" }}>
                    <th className={th} style={{ color: "var(--sh-muted)" }}>Name</th>
                    <th className={`${th} text-center w-40`} style={{ color: "var(--sh-muted)" }}>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--sh-border)" }}>
                      <td className={`${tdBase} font-medium`} style={{ color: "var(--sh-text)" }}>{r.name}</td>
                      <td className={`${tdBase} text-center text-xs font-semibold`}>
                        {r.status === "added"
                          ? <span style={{ color: "var(--sh-primary)" }}>✓ Imported</span>
                          : <span style={{ color: "var(--sh-danger)" }} title={r.message}>✗ {r.message}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end"><Button onClick={handleClose}>Done</Button></div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
