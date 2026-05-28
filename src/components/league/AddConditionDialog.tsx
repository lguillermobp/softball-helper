"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/context/language-context";

interface ConditionData {
  id: string;
  title: string;
  content: string | null;
  fileUrl: string | null;
  fileName: string | null;
  fileType: string | null;
}

interface Props {
  slug: string;
  condition?: ConditionData;   // present = edit mode
  trigger?: React.ReactNode;
}

const ACCEPTED = ".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp";
const MAX_MB   = 10;

export function AddConditionDialog({ slug, condition, trigger }: Props) {
  const router = useRouter();
  const { t } = useLanguage();
  const tc = t.league.conditions;
  const isEdit = !!condition;

  const [open, setOpen]           = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [mode, setMode]           = useState<"text" | "file" | "both">(
    isEdit ? (condition!.fileUrl ? (condition!.content ? "both" : "file") : "text") : "text"
  );

  // File state
  const [fileData, setFileData]     = useState<string | null>(null);
  const [fileName, setFileName]     = useState(condition?.fileName ?? "");
  const [fileType, setFileType]     = useState(condition?.fileType ?? "");
  const [removeFile, setRemoveFile] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleClose() {
    setOpen(false);
    setError("");
    setFileData(null);
    setRemoveFile(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`File exceeds ${MAX_MB} MB limit`);
      e.target.value = "";
      return;
    }
    setError("");
    setFileName(file.name);
    setFileType(file.type);

    const reader = new FileReader();
    reader.onload = (ev) => setFileData(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const title   = (fd.get("title") as string)?.trim();
    const content = (fd.get("content") as string)?.trim();

    const hasText = !!content && (mode === "text" || mode === "both");
    const hasFile = (!!fileData || (isEdit && condition!.fileUrl && !removeFile)) && (mode === "file" || mode === "both");

    if (!hasText && !hasFile) {
      setError(tc.errorNeedContent);
      setLoading(false);
      return;
    }

    const body: Record<string, unknown> = {
      title,
      content: hasText ? content : "",
    };
    if (fileData) {
      body.fileDataUrl = fileData;
      body.fileName    = fileName;
      body.fileType    = fileType;
    }
    if (isEdit && removeFile) body.removeFile = true;

    const url  = isEdit ? `/api/leagues/${slug}/conditions/${condition!.id}` : `/api/leagues/${slug}/conditions`;
    const method = isEdit ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? tc.errorSave);
      return;
    }
    handleClose();
    router.refresh();
  }

  const card2 = { borderColor: "var(--sh-border)", background: "var(--sh-bg-card2)" };
  const modeBtn = (m: typeof mode, label: string) => (
    <button
      key={m}
      type="button"
      onClick={() => setMode(m)}
      className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all"
      style={mode === m
        ? { background: "var(--sh-primary-dark)", color: "#fff" }
        : { color: "var(--sh-primary)", background: "transparent" }}
    >
      {label}
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true); }}>
      <DialogTrigger asChild>
        {trigger ?? <Button size="sm">+ {tc.add}</Button>}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? tc.editTitle : tc.addTitle}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-1">
            <Label htmlFor="cond-title">{tc.titleLabel} *</Label>
            <Input
              id="cond-title"
              name="title"
              placeholder={tc.titlePlaceholder}
              defaultValue={condition?.title ?? ""}
              required
            />
          </div>

          {/* Mode selector */}
          <div
            className="flex gap-1 rounded-xl p-1"
            style={{ background: "var(--sh-bg-card2)", border: "1px solid var(--sh-border)" }}
          >
            {modeBtn("text", tc.modeText)}
            {modeBtn("file", tc.modeFile)}
            {modeBtn("both", tc.modeBoth)}
          </div>

          {/* Text content */}
          {(mode === "text" || mode === "both") && (
            <div className="space-y-1">
              <Label htmlFor="cond-content">{tc.contentLabel}</Label>
              <textarea
                id="cond-content"
                name="content"
                rows={6}
                placeholder={tc.contentPlaceholder}
                defaultValue={condition?.content ?? ""}
                className="w-full rounded-md border px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          )}

          {/* File upload */}
          {(mode === "file" || mode === "both") && (
            <div className="space-y-2">
              <Label>{tc.fileLabel}</Label>

              {/* Show existing file if editing */}
              {isEdit && condition?.fileUrl && !removeFile && !fileData && (
                <div
                  className="flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm"
                  style={card2}
                >
                  <span className="truncate" style={{ color: "var(--sh-text)" }}>
                    📎 {condition.fileName ?? tc.existingFile}
                  </span>
                  <button
                    type="button"
                    onClick={() => setRemoveFile(true)}
                    className="ml-2 shrink-0 text-xs hover:opacity-80"
                    style={{ color: "var(--sh-danger)" }}
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* File input */}
              {(!isEdit || removeFile || !condition?.fileUrl || fileData) && (
                <div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept={ACCEPTED}
                    onChange={handleFileChange}
                    className="w-full rounded-md border px-3 py-2 text-sm cursor-pointer"
                    style={{ borderColor: "var(--sh-border)", color: "var(--sh-text)", background: "var(--sh-bg-card2)" }}
                  />
                  <p className="text-xs mt-1" style={{ color: "var(--sh-muted)" }}>
                    {tc.fileHint} ({MAX_MB} MB max)
                  </p>
                </div>
              )}

              {fileData && (
                <p className="text-xs" style={{ color: "var(--sh-primary)" }}>
                  ✓ {fileName}
                </p>
              )}
            </div>
          )}

          {error && <p className="text-sm" style={{ color: "var(--sh-danger)" }}>{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? tc.saving : (isEdit ? tc.saveEdit : tc.saveAdd)}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
