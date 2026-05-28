"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/context/language-context";
import { AddConditionDialog } from "./AddConditionDialog";

interface Condition {
  id: string;
  title: string;
  content: string | null;
  fileUrl: string | null;
  fileName: string | null;
  fileType: string | null;
  order: number;
  createdAt: string;
  createdBy: { id: string; name: string | null; email: string };
}

interface Props {
  slug: string;
  isAdmin: boolean;
  conditions: Condition[];
}

function fileIcon(fileType: string | null): string {
  if (!fileType) return "📎";
  if (fileType.includes("pdf"))   return "📄";
  if (fileType.includes("word") || fileType.includes("document")) return "📝";
  if (fileType.includes("image")) return "🖼️";
  if (fileType.includes("text")) return "📋";
  return "📎";
}

export function ConditionsSection({ slug, isAdmin, conditions: initial }: Props) {
  const router = useRouter();
  const { t } = useLanguage();
  const tc = t.league.conditions;

  const [deleting, setDeleting] = useState<string | null>(null);
  const [errors, setErrors]     = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const card = { borderColor: "var(--sh-border)", background: "var(--sh-bg-card)" };

  async function handleDelete(id: string) {
    setDeleting(id);
    setErrors(prev => ({ ...prev, [id]: "" }));
    const res = await fetch(`/api/leagues/${slug}/conditions/${id}`, { method: "DELETE" });
    setDeleting(null);
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json();
      setErrors(prev => ({ ...prev, [id]: data.error ?? tc.errorDelete }));
    }
  }

  function toggle(id: string) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  }

  const CONTENT_PREVIEW = 220;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold" style={{ color: "var(--sh-text)" }}>{tc.title}</h2>
        {isAdmin && <AddConditionDialog slug={slug} />}
      </div>

      {/* Empty state */}
      {initial.length === 0 && (
        <div
          className="rounded-2xl border py-14 text-center text-sm"
          style={{ ...card, color: "var(--sh-primary)" }}
        >
          {tc.none}{isAdmin && ` ${tc.noneHint}`}
        </div>
      )}

      {/* Condition cards */}
      <div className="space-y-3">
        {initial.map((c) => {
          const isExpanded = expanded[c.id] ?? false;
          const isLong     = (c.content?.length ?? 0) > CONTENT_PREVIEW;
          const preview    = isLong && !isExpanded
            ? c.content!.slice(0, CONTENT_PREVIEW) + "…"
            : c.content;

          return (
            <div key={c.id} className="rounded-2xl border p-5 space-y-3" style={card}>
              {/* Error */}
              {errors[c.id] && (
                <p className="text-xs" style={{ color: "var(--sh-danger)" }}>{errors[c.id]}</p>
              )}

              {/* Title row */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-lg shrink-0">📋</span>
                  <h3 className="font-bold text-sm" style={{ color: "var(--sh-text)" }}>{c.title}</h3>
                </div>

                {isAdmin && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <AddConditionDialog
                      slug={slug}
                      condition={c}
                      trigger={
                        <button
                          className="text-xs px-2 py-1 rounded-md border hover:opacity-80"
                          style={{ borderColor: "var(--sh-border2)", color: "var(--sh-primary)", background: "transparent" }}
                        >
                          {tc.edit}
                        </button>
                      }
                    />
                    <button
                      onClick={() => handleDelete(c.id)}
                      disabled={deleting === c.id}
                      className="text-xs px-2 py-1 rounded-md border hover:opacity-80 disabled:opacity-40"
                      style={{ borderColor: "var(--sh-danger-border)", color: "var(--sh-danger)", background: "transparent" }}
                    >
                      {deleting === c.id ? "…" : tc.delete}
                    </button>
                  </div>
                )}
              </div>

              {/* Text content */}
              {c.content && (
                <div>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: "var(--sh-text)" }}>
                    {preview}
                  </p>
                  {isLong && (
                    <button
                      type="button"
                      onClick={() => toggle(c.id)}
                      className="text-xs mt-1 hover:opacity-80"
                      style={{ color: "var(--sh-primary)" }}
                    >
                      {isExpanded ? tc.showLess : tc.showMore}
                    </button>
                  )}
                </div>
              )}

              {/* File attachment */}
              {c.fileUrl && (
                <a
                  href={c.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all hover:opacity-80"
                  style={{ borderColor: "var(--sh-border2)", background: "var(--sh-bg-card2)", color: "var(--sh-primary)" }}
                >
                  <span>{fileIcon(c.fileType)}</span>
                  <span className="truncate max-w-xs">{c.fileName ?? tc.viewFile}</span>
                  <span className="shrink-0 text-xs" style={{ color: "var(--sh-muted)" }}>↗</span>
                </a>
              )}

              {/* Footer */}
              <p className="text-xs" style={{ color: "var(--sh-muted)" }}>
                {tc.addedBy} {c.createdBy.name ?? c.createdBy.email}
                {" · "}
                {new Date(c.createdAt).toLocaleDateString()}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
