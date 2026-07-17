"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TIMEZONES } from "@/lib/timezones";

const TYPES = [
  { value: "MORNING", label: "Morning" },
  { value: "AFTERNOON", label: "Afternoon" },
  { value: "NIGHT", label: "Night" },
];

const DAYS = [
  { key: "slotsMonday",    label: "Mon" },
  { key: "slotsTuesday",   label: "Tue" },
  { key: "slotsWednesday", label: "Wed" },
  { key: "slotsThursday",  label: "Thu" },
  { key: "slotsFriday",    label: "Fri" },
  { key: "slotsSaturday",  label: "Sat" },
  { key: "slotsSunday",    label: "Sun" },
] as const;

type DayKey = typeof DAYS[number]["key"];

interface FieldData {
  id: string; name: string; types: string[];
  timezone?: string | null;
  slotStartTime?: string | null;
  slotDurationMins?: number;
  slotsMonday?: number; slotsTuesday?: number; slotsWednesday?: number;
  slotsThursday?: number; slotsFriday?: number; slotsSaturday?: number; slotsSunday?: number;
  defaultScorekeeperUserId?: string | null;
  defaultUmpireUserId?: string | null;
}

interface Official { id: string; name: string | null; role: string }

interface Props {
  slug: string;
  field?: FieldData;
  officials?: Official[];
  trigger?: React.ReactNode;
  onClose?: () => void;
}

export function AddFieldDialog({ slug, field, officials = [], trigger, onClose }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string[]>(field?.types ?? []);
  const [defaultScorekeeperUserId, setDefaultScorekeeperUserId] = useState(field?.defaultScorekeeperUserId ?? "");
  const [defaultUmpireUserId, setDefaultUmpireUserId]           = useState(field?.defaultUmpireUserId ?? "");
  const [timezone, setTimezone] = useState(field?.timezone ?? "UTC");
  const [slotStartTime, setSlotStartTime] = useState(field?.slotStartTime ?? "");
  const [slotDurationMins, setSlotDurationMins] = useState(String(field?.slotDurationMins ?? 90));
  const [daySlots, setDaySlots] = useState<Record<DayKey, number>>({
    slotsMonday:    field?.slotsMonday    ?? 0,
    slotsTuesday:   field?.slotsTuesday   ?? 0,
    slotsWednesday: field?.slotsWednesday ?? 0,
    slotsThursday:  field?.slotsThursday  ?? 0,
    slotsFriday:    field?.slotsFriday    ?? 0,
    slotsSaturday:  field?.slotsSaturday  ?? 0,
    slotsSunday:    field?.slotsSunday    ?? 0,
  });

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
      body: JSON.stringify({
        name: fd.get("name"),
        types: selected,
        timezone: timezone || "UTC",
        slotStartTime: slotStartTime || null,
        slotDurationMins: parseInt(slotDurationMins) || 90,
        ...daySlots,
        defaultScorekeeperUserId: defaultScorekeeperUserId || null,
        defaultUmpireUserId: defaultUmpireUserId || null,
      }),
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

  const inputCls = "w-full rounded-lg border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500";
  const inputStyle = { borderColor: "var(--sh-border)", background: "var(--sh-bg-card2)", color: "var(--sh-text)" };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button size="sm">{field ? "Edit" : "+ Add field"}</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{field ? "Edit Field" : "New Field"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1">
            <Label htmlFor="name">Field name *</Label>
            <Input id="name" name="name" defaultValue={field?.name} placeholder="e.g. Field 1 - Central Park" required />
          </div>

          <div className="space-y-1">
            <Label htmlFor="timezone">Timezone</Label>
            <select
              id="timezone"
              value={timezone}
              onChange={e => setTimezone(e.target.value)}
              className={inputCls}
              style={inputStyle}
            >
              {TIMEZONES.map(tz => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
            <p className="text-xs" style={{ color: "var(--sh-muted)" }}>
              Used to display game times for this venue correctly.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Time slots (type)</Label>
            <div className="flex gap-3">
              {TYPES.map((t) => (
                <label key={t.value} className="flex items-center gap-1.5 cursor-pointer select-none text-sm"
                  style={{ color: selected.includes(t.value) ? "var(--sh-primary)" : "var(--sh-muted)" }}>
                  <input type="checkbox" checked={selected.includes(t.value)} onChange={() => toggle(t.value)} className="accent-green-500" />
                  {t.label}
                </label>
              ))}
            </div>
          </div>

          {/* Default officials */}
          {officials.length > 0 && (
            <div className="space-y-3 rounded-xl border p-4" style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card2)" }}>
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--sh-primary)" }}>
                Default Officials
              </p>
              <p className="text-xs" style={{ color: "var(--sh-muted)" }}>
                These will be automatically assigned when a game is created at this field.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Default Umpire</Label>
                  <select
                    value={defaultUmpireUserId ?? ""}
                    onChange={e => setDefaultUmpireUserId(e.target.value)}
                    className={inputCls} style={inputStyle}
                  >
                    <option value="">— None —</option>
                    {officials.filter(o => o.role === "UMPIRE").map(o => (
                      <option key={o.id} value={o.id}>{o.name ?? o.id}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Default Scorekeeper</Label>
                  <select
                    value={defaultScorekeeperUserId ?? ""}
                    onChange={e => setDefaultScorekeeperUserId(e.target.value)}
                    className={inputCls} style={inputStyle}
                  >
                    <option value="">— None —</option>
                    {officials.filter(o => o.role === "SCOREKEEPER").map(o => (
                      <option key={o.id} value={o.id}>{o.name ?? o.id}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Slot schedule */}
          <div className="space-y-3 rounded-xl border p-4" style={{ borderColor: "var(--sh-border)", background: "var(--sh-bg-card2)" }}>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--sh-primary)" }}>
              Schedule Generator Slots
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="slotStartTime">First slot start time</Label>
                <input
                  id="slotStartTime" type="time" value={slotStartTime}
                  onChange={e => setSlotStartTime(e.target.value)}
                  className={inputCls} style={inputStyle}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="slotDuration">Game duration (min)</Label>
                <input
                  id="slotDuration" type="number" min={30} max={240} value={slotDurationMins}
                  onChange={e => setSlotDurationMins(e.target.value)}
                  className={inputCls} style={inputStyle}
                  placeholder="90"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Slots per day of week</Label>
              <div className="grid grid-cols-7 gap-1.5">
                {DAYS.map(({ key, label }) => (
                  <div key={key} className="flex flex-col items-center gap-1">
                    <span className="text-xs font-semibold" style={{ color: "var(--sh-muted)" }}>{label}</span>
                    <input
                      type="number" min={0} max={10}
                      value={daySlots[key]}
                      onChange={e => setDaySlots(prev => ({ ...prev, [key]: parseInt(e.target.value) || 0 }))}
                      className="w-full text-center rounded-lg border py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      style={inputStyle}
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs" style={{ color: "var(--sh-muted)" }}>
                Each slot = 1 twin game pair (2 consecutive games). Twin block = 2 × game duration.
              </p>
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
