"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/context/language-context";

const STR = {
  en: {
    trigger: "+ Add team", title: "New Team", teamName: "Team name",
    seasonsLabel: "Seasons & divisions", pickSeason: "— Select season —",
    category: "Division (optional)", noCategory: "— No division —",
    addSeasonRow: "+ Add to another season", removeRow: "Remove",
    manager: "Manager", assistant: "Assistant",
    fullName: "Full name", email: "Email address", phone: "Mobile phone (optional)",
    managerPlays: "Manager also plays (Manager-player)", removeManager: "Remove manager",
    addManager: "+ Add manager (optional)",
    assistantPlays: "Assistant also plays (Assistant-player)", removeAssistant: "Remove assistant",
    addAssistant: "+ Add assistant (optional)",
    cancel: "Cancel", create: "Create team", saving: "Saving…", oops: "Something went wrong",
  },
  es: {
    trigger: "+ Agregar equipo", title: "Nuevo equipo", teamName: "Nombre del equipo",
    seasonsLabel: "Temporadas y divisiones", pickSeason: "— Seleccionar temporada —",
    category: "División (opcional)", noCategory: "— Sin división —",
    addSeasonRow: "+ Agregar a otra temporada", removeRow: "Quitar",
    manager: "Manager", assistant: "Asistente",
    fullName: "Nombre completo", email: "Correo electrónico", phone: "Teléfono móvil (opcional)",
    managerPlays: "El manager también juega (Manager-jugador)", removeManager: "Quitar manager",
    addManager: "+ Agregar manager (opcional)",
    assistantPlays: "El asistente también juega (Asistente-jugador)", removeAssistant: "Quitar asistente",
    addAssistant: "+ Agregar asistente (opcional)",
    cancel: "Cancelar", create: "Crear equipo", saving: "Guardando…", oops: "Algo salió mal",
  },
};

type Strings = typeof STR.en;

function StaffFields({ prefix, label, required, L }: { prefix: string; label: string; required?: boolean; L: Strings }) {
  return (
    <div className="space-y-3 rounded-xl p-3" style={{ background: "var(--sh-bg-card2)", border: "1px solid var(--sh-border)" }}>
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--sh-primary)" }}>
        {label}{required && " *"}
      </p>
      <div className="space-y-1">
        <Label htmlFor={`${prefix}-name`}>{L.fullName} {required && "*"}</Label>
        <Input id={`${prefix}-name`} name={`${prefix}-name`} placeholder="Jane Smith" required={required} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${prefix}-email`}>{L.email} {required && "*"}</Label>
        <Input id={`${prefix}-email`} name={`${prefix}-email`} type="email" placeholder="jane@example.com" required={required} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${prefix}-phone`}>{L.phone}</Label>
        <Input id={`${prefix}-phone`} name={`${prefix}-phone`} type="tel" placeholder="+1 555 000 0000" />
      </div>
    </div>
  );
}

export function AddTeamDialog({ slug }: { slug: string }) {
  const router = useRouter();
  const { locale } = useLanguage();
  const L = STR[locale === "es" ? "es" : "en"];
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasManager,    setHasManager]    = useState(false);
  const [hasAssistant,  setHasAssistant]  = useState(false);
  const [managerPlays,  setManagerPlays]  = useState(false);
  const [assistantPlays, setAssistantPlays] = useState(false);

  function handleClose() { setOpen(false); setHasManager(false); setHasAssistant(false); setManagerPlays(false); setAssistantPlays(false); setError(""); }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);

    const body: Record<string, unknown> = {
      name: fd.get("name"),
    };

    if (hasManager) {
      body.manager     = { name: fd.get("manager-name"), email: fd.get("manager-email"), phone: fd.get("manager-phone") || undefined };
      body.managerRole = managerPlays ? "TEAM_MANAGER_PLAYER" : "TEAM_MANAGER";
    }

    if (hasAssistant) {
      body.assistant = {
        name: fd.get("assistant-name"),
        email: fd.get("assistant-email"),
        phone: fd.get("assistant-phone") || undefined,
      };
      body.assistantRole = assistantPlays ? "TEAM_ASSISTANT_PLAYER" : "TEAM_ASSISTANT";
    }

    const res = await fetch(`/api/leagues/${slug}/teams`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? L.oops);
      return;
    }
    handleClose();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true); }}>
      <DialogTrigger asChild>
        <Button size="sm">{L.trigger}</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{L.title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="name">{L.teamName} *</Label>
            <Input id="name" name="name" placeholder="e.g. Tigers" required />
          </div>

          {hasManager ? (
            <div className="space-y-3">
              <StaffFields prefix="manager" label={L.manager} L={L} />
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={managerPlays} onChange={e => setManagerPlays(e.target.checked)}
                  className="w-4 h-4 rounded accent-green-500" />
                <span className="text-sm" style={{ color: "var(--sh-secondary)" }}>{L.managerPlays}</span>
              </label>
              <button type="button" className="text-xs underline" style={{ color: "var(--sh-danger)" }}
                onClick={() => { setHasManager(false); setManagerPlays(false); }}>
                {L.removeManager}
              </button>
            </div>
          ) : (
            <button type="button" className="text-sm underline" style={{ color: "var(--sh-primary)" }}
              onClick={() => setHasManager(true)}>
              {L.addManager}
            </button>
          )}

          {hasAssistant ? (
            <div className="space-y-2">
              <StaffFields prefix="assistant" label={L.assistant} L={L} />
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={assistantPlays}
                  onChange={(e) => setAssistantPlays(e.target.checked)}
                  className="w-4 h-4 rounded accent-indigo-500"
                />
                <span className="text-sm" style={{ color: "var(--sh-secondary)" }}>
                  {L.assistantPlays}
                </span>
              </label>
              <button
                type="button"
                className="text-xs underline"
                style={{ color: "var(--sh-danger)" }}
                onClick={() => { setHasAssistant(false); setAssistantPlays(false); }}
              >
                {L.removeAssistant}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="text-sm underline"
              style={{ color: "var(--sh-primary)" }}
              onClick={() => setHasAssistant(true)}
            >
              {L.addAssistant}
            </button>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>{L.cancel}</Button>
            <Button type="submit" disabled={loading}>{loading ? L.saving : L.create}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
