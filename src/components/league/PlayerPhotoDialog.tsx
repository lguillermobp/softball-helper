"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  slug: string;
  playerId: string;
  playerName: string;
  currentPhotoUrl?: string | null;
  onUpdated: (photoUrl: string) => void;
}

type Step = "select" | "camera" | "crop" | "uploading";

function centerAspectCrop(width: number, height: number): Crop {
  return centerCrop(
    makeAspectCrop({ unit: "%", width: 90 }, 1, width, height),
    width,
    height,
  );
}

function getCroppedDataUrl(image: HTMLImageElement, crop: Crop): string {
  const canvas = document.createElement("canvas");
  const size = 600;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  const cropX = (crop.unit === "%" ? (crop.x / 100) * image.width : crop.x) * scaleX;
  const cropY = (crop.unit === "%" ? (crop.y / 100) * image.height : crop.y) * scaleY;
  const cropW = (crop.unit === "%" ? (crop.width / 100) * image.width : crop.width) * scaleX;
  const cropH = (crop.unit === "%" ? (crop.height / 100) * image.height : crop.height) * scaleY;

  ctx.drawImage(image, cropX, cropY, cropW, cropH, 0, 0, size, size);
  return canvas.toDataURL("image/jpeg", 0.92);
}

const GUIDELINES = [
  "Plain light background (white or off-white)",
  "Face centred, looking straight at the camera",
  "Good lighting — no harsh shadows",
  "No sunglasses or hats",
  "Neutral expression or slight smile",
];

export function PlayerPhotoDialog({
  slug, playerId, playerName, currentPhotoUrl, onUpdated,
}: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("select");
  const [srcUrl, setSrcUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<Crop>();
  const [error, setError] = useState("");
  const [cameraError, setCameraError] = useState("");

  const imgRef = useRef<HTMLImageElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Stop camera stream whenever we leave the camera step or the dialog closes
  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function reset() {
    stopStream();
    setStep("select");
    setSrcUrl(null);
    setCrop(undefined);
    setCompletedCrop(undefined);
    setError("");
    setCameraError("");
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleClose() { setOpen(false); reset(); }

  // Clean up on unmount
  useEffect(() => () => stopStream(), []);

  // ── File upload ────────────────────────────────────────────────────────────
  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    const reader = new FileReader();
    reader.onload = () => { setSrcUrl(reader.result as string); setStep("crop"); };
    reader.readAsDataURL(file);
  }

  // ── Camera ─────────────────────────────────────────────────────────────────
  async function startCamera() {
    setCameraError("");
    setStep("camera");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      // Wait for videoRef to be mounted, then attach stream
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 50);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Camera unavailable";
      setCameraError(
        msg.includes("Permission") || msg.includes("NotAllowed")
          ? "Camera access denied. Please allow camera permission and try again."
          : "Could not access camera. Make sure it is connected and not in use by another app."
      );
    }
  }

  function captureFrame() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
    stopStream();
    setSrcUrl(dataUrl);
    setStep("crop");
  }

  // ── Crop ───────────────────────────────────────────────────────────────────
  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height));
  }, []);

  // ── Upload ─────────────────────────────────────────────────────────────────
  async function handleUpload() {
    if (!imgRef.current || !completedCrop) return;
    setStep("uploading");
    setError("");
    try {
      const dataUrl = getCroppedDataUrl(imgRef.current, completedCrop);
      const res = await fetch(`/api/leagues/${slug}/players/${playerId}/photo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Upload failed"); setStep("crop"); return; }
      onUpdated(data.photoUrl);
      handleClose();
    } catch {
      setError("Upload failed. Please try again.");
      setStep("crop");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true); }}>
      <DialogTrigger asChild>
        <button
          className="text-xs px-2 py-1 rounded-md border transition-colors hover:opacity-80"
          style={{ borderColor: "#2d5a2d", color: "#4ade80", background: "transparent" }}
          title="Update photo"
        >
          {currentPhotoUrl ? "Photo" : "+ Photo"}
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Player Photo — {playerName}</DialogTitle>
        </DialogHeader>

        {/* ── Step 1: Select ── */}
        {step === "select" && (
          <div className="space-y-4">
            <div className="rounded-lg p-3 space-y-1.5" style={{ background: "#0f2310", border: "1px solid #1e3a1e" }}>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#4ade80" }}>
                Photo guidelines
              </p>
              <ul className="space-y-1">
                {GUIDELINES.map((g) => (
                  <li key={g} className="text-xs flex items-start gap-1.5" style={{ color: "#86efac" }}>
                    <span style={{ color: "#4ade80" }}>•</span> {g}
                  </li>
                ))}
              </ul>
            </div>

            {currentPhotoUrl && (
              <div className="flex justify-center">
                <img
                  src={currentPhotoUrl}
                  alt={playerName}
                  className="w-24 h-24 rounded-full object-cover border-2"
                  style={{ borderColor: "#2d5a2d" }}
                />
              </div>
            )}

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={onFileChange}
              className="hidden"
              id={`photoFile-${playerId}`}
            />

            <div className="flex flex-col gap-2">
              <label
                htmlFor={`photoFile-${playerId}`}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer font-medium text-sm transition-colors hover:opacity-80"
                style={{ borderColor: "#2d5a2d", color: "#f0fdf4", background: "#1a3d1a" }}
              >
                ↑ Upload from device
              </label>
              <button
                onClick={startCamera}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border font-medium text-sm transition-colors hover:opacity-80"
                style={{ borderColor: "#2d5a2d", color: "#4ade80", background: "transparent" }}
              >
                📷 Use camera
              </button>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex justify-end">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
            </div>
          </div>
        )}

        {/* ── Step 2: Camera ── */}
        {step === "camera" && (
          <div className="space-y-4">
            {cameraError ? (
              <div className="rounded-lg p-4 text-sm text-red-400" style={{ background: "#1a0707", border: "1px solid #3f1515" }}>
                {cameraError}
              </div>
            ) : (
              <div className="relative rounded-xl overflow-hidden bg-black" style={{ aspectRatio: "4/3" }}>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{ transform: "scaleX(-1)" /* mirror effect */ }}
                />
                {/* Oval face guide */}
                <svg
                  className="pointer-events-none absolute inset-0 w-full h-full"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  <ellipse
                    cx="50" cy="44" rx="22" ry="30"
                    fill="none"
                    stroke="rgba(74,222,128,0.6)"
                    strokeWidth="0.8"
                    strokeDasharray="4 3"
                  />
                </svg>
              </div>
            )}

            <p className="text-xs text-center" style={{ color: "#6b7280" }}>
              Centre your face inside the oval guide, then tap Capture.
            </p>

            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => { stopStream(); setStep("select"); }}>
                ← Back
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose}>Cancel</Button>
                {!cameraError && (
                  <Button onClick={captureFrame}>
                    📸 Capture
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: Crop ── */}
        {step === "crop" && srcUrl && (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: "#86efac" }}>
              Drag to adjust the crop. The photo will be saved as a square.
            </p>

            <div className="relative flex justify-center">
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={1}
                circularCrop
                minWidth={60}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imgRef}
                  src={srcUrl}
                  alt="Crop preview"
                  onLoad={onImageLoad}
                  style={{ maxHeight: "55vh", objectFit: "contain" }}
                />
              </ReactCrop>

              {/* Oval face guide overlay */}
              <svg
                className="pointer-events-none absolute inset-0 w-full h-full"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                <ellipse
                  cx="50" cy="42" rx="22" ry="28"
                  fill="none"
                  stroke="rgba(74,222,128,0.55)"
                  strokeWidth="1"
                  strokeDasharray="4 3"
                />
              </svg>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => { setSrcUrl(null); setStep("select"); }}>
                ← Back
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose}>Cancel</Button>
                <Button onClick={handleUpload} disabled={!completedCrop}>
                  Save photo
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 4: Uploading ── */}
        {step === "uploading" && (
          <div className="flex flex-col items-center justify-center gap-4 py-8">
            <div
              className="w-10 h-10 rounded-full border-4 animate-spin"
              style={{ borderColor: "#4ade80", borderTopColor: "transparent" }}
            />
            <p className="text-sm" style={{ color: "#86efac" }}>Uploading photo…</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
