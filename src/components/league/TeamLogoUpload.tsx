"use client";

import { useRef, useState } from "react";

interface Props {
  slug: string;
  teamId: string;
  teamName: string;
  currentLogoUrl: string | null;
  onUpdated: (logoUrl: string) => void;
}

export function TeamLogoUpload({ slug, teamId, teamName, currentLogoUrl, onUpdated }: Props) {
  const inputRef            = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError]   = useState("");

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please select an image file."); return; }
    if (file.size > 5 * 1024 * 1024)    { setError("Image must be under 5 MB."); return; }
    setError("");
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleUpload() {
    if (!preview) return;
    setUploading(true);
    setError("");
    const res = await fetch(`/api/leagues/${slug}/teams/${teamId}/logo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl: preview }),
    });
    setUploading(false);
    if (!res.ok) { const d = await res.json(); setError(d.error ?? "Upload failed"); return; }
    const { logoUrl } = await res.json();
    onUpdated(logoUrl);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function cancel() {
    setPreview(null);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  const logo = preview ?? currentLogoUrl;

  return (
    <div className="flex items-center gap-3">
      {/* Current logo / preview */}
      <div className="relative shrink-0">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt={teamName}
            className="w-14 h-14 rounded-xl object-cover"
            style={{ border: "2px solid var(--sh-border2)" }} />
        ) : (
          <div className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold"
            style={{ background: "var(--sh-bg-card2)", color: "var(--sh-primary)", border: "2px dashed var(--sh-border2)" }}>
            {teamName.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5 min-w-0">
        {preview ? (
          <div className="flex items-center gap-2">
            <button onClick={handleUpload} disabled={uploading}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#16a34a,#15803d)", color: "#fff" }}>
              {uploading ? "Uploading…" : "Save logo"}
            </button>
            <button onClick={cancel}
              className="text-xs px-2 py-1.5 rounded-lg border transition-colors"
              style={{ borderColor: "var(--sh-border2)", color: "var(--sh-muted)", background: "transparent" }}>
              Cancel
            </button>
          </div>
        ) : (
          <button onClick={() => inputRef.current?.click()}
            className="text-xs px-3 py-1.5 rounded-lg border transition-colors hover:opacity-80 w-fit"
            style={{ borderColor: "var(--sh-border2)", color: "var(--sh-primary)", background: "transparent" }}>
            {currentLogoUrl ? "Change logo" : "Upload logo"}
          </button>
        )}
        {error && <p className="text-xs" style={{ color: "var(--sh-danger)" }}>{error}</p>}
        <p className="text-xs" style={{ color: "var(--sh-muted)" }}>PNG, JPG · max 5 MB</p>
      </div>

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}
