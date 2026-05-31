import { prisma } from "@/lib/prisma";

export interface AuditActor {
  id:    string;
  name:  string | null | undefined;
  email: string | null | undefined;
}

export interface AuditContext {
  actor:      AuditActor;
  action:     string;
  entityType?: string;
  entityId?:   string;
  leagueId?:   string;
  leagueName?: string;
  metadata?:   Record<string, unknown>;
}

export function logAudit(ctx: AuditContext): void {
  prisma.auditLog.create({
    data: {
      userId:     ctx.actor.id,
      userName:   ctx.actor.name  ?? null,
      userEmail:  ctx.actor.email ?? null,
      action:     ctx.action,
      entityType: ctx.entityType  ?? null,
      entityId:   ctx.entityId    ?? null,
      leagueId:   ctx.leagueId    ?? null,
      leagueName: ctx.leagueName  ?? null,
      metadata:   ctx.metadata ? JSON.parse(JSON.stringify(ctx.metadata)) : undefined,
    },
  }).catch((e) => console.error("[AUDIT]", ctx.action, e));
}
