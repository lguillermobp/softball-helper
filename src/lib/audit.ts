import { prisma } from "@/lib/prisma";

export interface AuditActor {
  id:    string;
  name:  string | null | undefined;
  email: string | null | undefined;
}

export interface AuditContext {
  actor:       AuditActor;
  action:      string;
  entityType?: string;
  entityId?:   string;
  leagueId?:   string;
  leagueName?: string;
  metadata?:   Record<string, unknown>;
  ipAddress?:  string;
  location?:   string;
}

/** Extract IP and geo-location from a Next.js request without any external API call. */
export function getRequestMeta(req: { headers: { get(name: string): string | null } }): {
  ipAddress?: string;
  location?:  string;
} {
  const h = req.headers;

  // IP: prefer the first hop of x-forwarded-for, then fallbacks
  const forwarded = h.get("x-forwarded-for");
  const ipAddress = (forwarded ? forwarded.split(",")[0].trim() : undefined)
    ?? h.get("x-real-ip")
    ?? h.get("cf-connecting-ip")
    ?? undefined;

  // Location: Vercel edge geo headers, then Cloudflare country
  const city    = h.get("x-vercel-ip-city") ?? undefined;
  const region  = h.get("x-vercel-ip-country-region") ?? undefined;
  const country = h.get("x-vercel-ip-country") ?? h.get("cf-ipcountry") ?? undefined;

  const parts = [city, region, country].filter(Boolean);
  const location = parts.length > 0 ? parts.join(", ") : undefined;

  return { ipAddress: ipAddress || undefined, location: location || undefined };
}

export function logAudit(ctx: AuditContext): Promise<void> {
  return prisma.auditLog.create({
    data: {
      userId:     ctx.actor.id    ?? null,
      userName:   ctx.actor.name  ?? null,
      userEmail:  ctx.actor.email ?? null,
      action:     ctx.action,
      entityType: ctx.entityType  ?? null,
      entityId:   ctx.entityId    ?? null,
      leagueId:   ctx.leagueId    ?? null,
      leagueName: ctx.leagueName  ?? null,
      metadata:   ctx.metadata ? JSON.parse(JSON.stringify(ctx.metadata)) : null,
      ipAddress:  ctx.ipAddress   ?? null,
      location:   ctx.location    ?? null,
    },
  }).then(() => {}).catch((e) => {
    console.error("[AUDIT] Failed to write log for action:", ctx.action, e?.message ?? e);
  });
}
