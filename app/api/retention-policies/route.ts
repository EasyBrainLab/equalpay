import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { badRequest, forbidden, ok, readJson, unauthorized } from "@/lib/server/api";
import { requirePermission } from "@/lib/server/context";
import { writeAuditLog } from "@/lib/server/audit";

const retentionSchema = z.object({
  entityType: z.string().min(1),
  retentionDays: z.number().int().positive(),
  action: z.enum(["REVIEW", "ANONYMIZE", "DELETE", "LEGAL_HOLD"]).default("REVIEW"),
  legalBasis: z.string().min(1),
  active: z.boolean().default(true),
});

const retentionDeleteSchema = z.object({ id: z.string().min(1) });

export async function GET() {
  const { ctx, error } = await requirePermission("retention:admin");
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();

  const policies = await prisma.retentionPolicy.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { entityType: "asc" } });
  return ok({ policies });
}

export async function POST(request: Request) {
  const { ctx, error } = await requirePermission("retention:admin");
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();

  const input = await readJson(request, retentionSchema);
  const policy = await prisma.retentionPolicy.upsert({
    where: { tenantId_entityType: { tenantId: ctx.tenantId, entityType: input.entityType } },
    update: {
      retentionDays: input.retentionDays,
      action: input.action,
      legalBasis: input.legalBasis,
      active: input.active,
    },
    create: { tenantId: ctx.tenantId, ...input },
  });
  await writeAuditLog({
    tenantId: ctx.tenantId,
    userId: ctx.user.id,
    action: "retention-policy.upsert",
    entityType: "RetentionPolicy",
    entityId: policy.id,
    severity: "CRITICAL",
    metadata: { entityType: policy.entityType, retentionDays: policy.retentionDays, action: policy.action },
  });
  return ok({ policyId: policy.id });
}

export async function DELETE(request: Request) {
  const { ctx, error } = await requirePermission("retention:admin");
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();
  const { id } = await readJson(request, retentionDeleteSchema);
  const existing = await prisma.retentionPolicy.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!existing) return badRequest("Retention Policy nicht gefunden");
  await prisma.retentionPolicy.delete({ where: { id } });
  await writeAuditLog({
    tenantId: ctx.tenantId,
    userId: ctx.user.id,
    action: "retention-policy.delete",
    entityType: "RetentionPolicy",
    entityId: id,
    severity: "CRITICAL",
    metadata: { entityType: existing.entityType },
  });
  return ok({ deleted: id });
}
