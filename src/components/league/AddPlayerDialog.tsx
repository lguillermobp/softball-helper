"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COUNTRIES } from "@/lib/countries";
import { useLanguage } from "@/context/language-context";

interface Props {
  slug: string;
  teamId: string;
  teamName: string;
  requireDob?: boolean;
}

const STR = {
  en: {
    trigger: "+ Add player", title: (t: string) => `Add Player to ${t}`,
    fullName: "Full name", email: "Email address",
    emailPlaceholder: "player@example.com (optional)",
    emailHelp: "Optional. If provided, the player will be linked to their account or receive an invitation. Can be added later.",
    jersey: "Jersey number", dob: "Date of birth", nationality: "Nationality",
    none: "— None —", cancel: "Cancel", add: "Add player", adding: "Adding…", oops: "Something went wrong",
  },
  es: {
    trigger: "+ Agregar jugador", title: (t: string) => `Agregar jugador a ${t}`,
    fullName: "Nombre completo", email: "Correo electrónico",
    emailPlaceholder: "jugador@ejemplo.com (opcional)",
    emailHelp: "Opcional. Si lo agregas, el jugador se vinculará a su cuenta o recibirá una invitación. Puedes agregarlo después.",
    jersey: "Número de camiseta", dob: "Fecha de nacimiento", nationality: "Nacionalidad",
    none: "— Ninguna —", cancel: "Cancelar", add: "Agregar jugador", adding: "Agregando…", oops: "Algo salió mal",
  },
};

export function AddPlayerDialog({ slug, teamId, teamName, requireDob = false }: Props) {
  const router = useRouter();
  const { locale } = useLanguage();
  const L = STR[locale === "es" ? "es" : "en"];
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch(`/api/leagues/${slug}/players`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        email: fd.get("email"),
        jerseyNumber: fd.get("jerseyNumber") || null,
        nationality: fd.get("nationality") || null,
        dob: fd.get("dob") || null,
        teamId,
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
        <Button size="sm" variant="outline">{L.trigger}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{L.title(teamName)}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="name">{L.fullName} *</Label>
            <Input id="name" name="name" placeholder="Jane Smith" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="email">{L.email}</Label>
            <Input id="email" name="email" type="email" placeholder={L.emailPlaceholder} />
            <p className="text-xs" style={{ color: "var(--sh-muted)" }}>
              {L.emailHelp}
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="jerseyNumber">{L.jersey}</Label>
            <Input id="jerseyNumber" name="jerseyNumber" placeholder="e.g. 7" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="dob">{L.dob}{requireDob ? " *" : ""}</Label>
            <Input id="dob" name="dob" type="date" required={requireDob} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="nationality">{L.nationality}</Label>
            <select id="nationality" name="nationality"
              className="w-full rounded-md border px-3 py-2 text-sm outline-none"
              style={{ background: "var(--sh-bg-card2)", borderColor: "var(--sh-border)", color: "var(--sh-text)" }}>
              <option value="">{L.none}</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>{L.cancel}</Button>
            <Button type="submit" disabled={loading}>{loading ? L.adding : L.add}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
