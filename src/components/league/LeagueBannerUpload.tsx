"use client";

import { useRef, useState } from "react";

interface Props {
  slug: string;
  currentBannerUrl: string | null;
  onUpdated: (bannerUrl: string | null) => void;
}

export function LeagueBannerUpload({ slug, currentBannerUrl, onUpdated }: Props) {
  const inputRef               = useRef<HTMLInputElement>(null);
  const [preview, setPreview]  = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError]      = useState("");

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please select an image file."); return; }
    if (file.size > 10 * 1024 * 1024)   { setError("Image must be under 10 MB."); return; }
    setError("");
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleUpload() {
    if (!preview) return;
    setUploading(true);
    setError("");
    const res = await fetch(`/api/leagues/${slug}/banner`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl: preview }),
    });
    setUploading(false);
    if (!res.ok) { const d = await res.json(); setError(d.error ?? "Upload failed"); return; }
    const { bannerUrl } = await res.json();
    onUpdated(bannerUrl);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleRemove() {
    setError("");
    const res = await fetch(`/api/leagues/${slug}/banner`, { method: "DELETE" });
    if (!res.ok) { const d = await res.json(); setError(d.error ?? "Failed to remove"); return; }
    onUpdated(null);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function cancel() {
    setPreview(null);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  const shown = preview ?? currentBannerUrl;

  return (
    <div className="flex flex-col gap-3">
      {/* Preview */}
      {shown && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={shown} alt="Banner preview"
          className="w-full rounded-xl object-cover"
          style={{ height: 120, border: "1px solid var(--sh-border2)" }} />
      )}
      {!shown && (
        <div className="w-full rounded-xl flex items-center justify-center"
          style={{ height: 80, border: "2px dashed var(--sh-border2)", background: "var(--sh-bg-card2)", color: "var(--sh-muted)", fontSize: 13 }}>
          No banner · wide landscape image recommended
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {preview ? (
          <>
            <button onClick={handleUpload} disabled={uploading}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#16a34a,#15803d)", color: "#fff" }}>
              {uploading ? "Uploading…" : "Save banner"}
            </button>
            <button onClick={cancel}
              className="text-xs px-2 py-1.5 rounded-lg border transition-colors"
              style={{ borderColor: "var(--sh-border2)", color: "var(--sh-muted)", background: "transparent" }}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <button onClick={() => inputRef.current?.click()}
              className="text-xs px-3 py-1.5 rounded-lg border transition-colors hover:opacity-80"
              style={{ borderColor: "var(--sh-border2)", color: "var(--sh-primary)", background: "transparent" }}>
              {currentBannerUrl ? "Change banner" : "Upload banner"}
            </button>
            {currentBannerUrl && (
              <button onClick={handleRemove}
                className="text-xs px-2 py-1.5 rounded-lg border transition-colors hover:opacity-80"
                style={{ borderColor: "var(--sh-border2)", color: "var(--sh-danger)", background: "transparent" }}>
                Remove
              </button>
            )}
          </>
        )}
      </div>

      {error && <p className="text-xs" style={{ color: "var(--sh-danger)" }}>{error}</p>}
      <p className="text-xs" style={{ color: "var(--sh-muted)" }}>PNG, JPG · max 10 MB · cropped to 1600 × 300</p>

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}
