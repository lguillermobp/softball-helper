"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COUNTRIES } from "@/lib/countries";
import { useLanguage } from "@/context/language-context";

interface Player {
  id: string;
  name: string;
  email: string | null;
  jerseyNumber: string | null;
  nationality: string | null;
  dob: string | null;
}

interface Props {
  slug: string;
  player: Player;
  requireDob?: boolean;
}

const STR = {
  en: {
    edit: "Edit", title: "Edit Player", fullName: "Full name", email: "Email address",
    emailPlaceholder: "player@example.com (optional)", jersey: "Jersey number",
    dob: "Date of birth", nationality: "Nationality", none: "— None —",
    cancel: "Cancel", save: "Save", saving: "Saving…", oops: "Something went wrong",
  },
  es: {
    edit: "Editar", title: "Editar jugador", fullName: "Nombre completo", email: "Correo electrónico",
    emailPlaceholder: "jugador@ejemplo.com (opcional)", jersey: "Número de camiseta",
    dob: "Fecha de nacimiento", nationality: "Nacionalidad", none: "— Ninguna —",
    cancel: "Cancelar", save: "Guardar", saving: "Guardando…", oops: "Algo salió mal",
  },
};

export function EditPlayerDialog({ slug, player, requireDob = false }: Props) {
  const router = useRouter();
  const { locale } = useLanguage();
  const L = STR[locale === "es" ? "es" : "en"];
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch(`/api/leagues/${slug}/players/${player.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name:         fd.get("name"),
        email:        fd.get("email"),
        jerseyNumber: fd.get("jerseyNumber") || null,
        nationality:  fd.get("nationality") || null,
        dob:          fd.get("dob") || null,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? L.oops);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="text-xs px-2 py-1 rounded-md border hover:opacity-80"
          style={{ borderColor: "var(--sh-border2)", color: "var(--sh-primary)", background: "transparent" }}
        >
          {L.edit}
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{L.title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="ep-name">{L.fullName} *</Label>
            <Input id="ep-name" name="name" defaultValue={player.name} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ep-email">{L.email}</Label>
            <Input id="ep-email" name="email" type="email" defaultValue={player.email ?? ""} placeholder={L.emailPlaceholder} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ep-jersey">{L.jersey}</Label>
            <Input id="ep-jersey" name="jerseyNumber" defaultValue={player.jerseyNumber ?? ""} placeholder="e.g. 7" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ep-dob">{L.dob}{requireDob ? " *" : ""}</Label>
            <Input id="ep-dob" name="dob" type="date"
              defaultValue={player.dob ? player.dob.slice(0, 10) : ""}
              required={requireDob} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ep-nationality">{L.nationality}</Label>
            <select id="ep-nationality" name="nationality" defaultValue={player.nationality ?? ""}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none"
              style={{ background: "var(--sh-bg-card2)", borderColor: "var(--sh-border)", color: "var(--sh-text)" }}>
              <option value="">{L.none}</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm" style={{ color: "#f87171" }}>{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>{L.cancel}</Button>
            <Button type="submit" disabled={loading}>{loading ? L.saving : L.save}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
