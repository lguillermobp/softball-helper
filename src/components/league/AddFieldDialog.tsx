"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TYPES = [
  { value: "MORNING", label: "Morning" },
  { value: "AFTERNOON", label: "Afternoon" },
  { value: "NIGHT", label: "Night" },
];

interface Props {
  slug: string;
  field?: { id: string; name: string; types: string[] };
  trigger?: React.ReactNode;
  onClose?: () => void;
}

export function AddFieldDialog({ slug, field, trigger, onClose }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string[]>(field?.types ?? []);

  function toggle(v: string) {
    setSelected((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const url = field
      ? `/api/leagues/${slug}/fields/${field.id}`
      : `/api/leagues/${slug}/fields`;
    const res = await fetch(url, {
      method: field ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: fd.get("name"), types: selected }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Something went wrong");
      return;
    }
    setOpen(false);
    onClose?.();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button size="sm">{field ? "Edit" : "+ Add field"}</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{field ? "Edit Field" : "New Field"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="name">Field name *</Label>
            <Input id="name" name="name" defaultValue={field?.name} placeholder="e.g. Field 1 - Central Park" required />
          </div>
          <div className="space-y-2">
            <Label>Time slots</Label>
            <div className="flex gap-3">
              {TYPES.map((t) => (
                <label
                  key={t.value}
                  className="flex items-center gap-1.5 cursor-pointer select-none text-sm"
                  style={{ color: selected.includes(t.value) ? "#4ade80" : "#6b7280" }}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(t.value)}
                    onChange={() => toggle(t.value)}
                    className="accent-green-500"
                  />
                  {t.label}
                </label>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Saving…" : field ? "Save" : "Add field"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
