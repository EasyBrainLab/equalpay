import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { badRequest, forbidden, ok, readJson, unauthorized } from "@/lib/server/api";
import { requirePermission } from "@/lib/server/context";
import { writeAuditLog } from "@/lib/server/audit";

const remediationSchema = z.object({
  payGapRowId: z.string().optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  rootCause: z.string().optional(),
  objectiveReason: z.string().optional(),
  ownerUserId: z.string().optional(),
  dueAt: z.coerce.date(),
});

const remediationUpdateSchema = z.object({
  id: z.string().min(1),
  payGapRowId: z.string().nullable().optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  rootCause: z.string().nullable().optional(),
  objectiveReason: z.string().nullable().optional(),
  ownerUserId: z.string().nullable().optional(),
  dueAt: z.coerce.date(),
  status: z.enum(["OPEN", "IN_PROGRESS", "WAITING_FOR_APPROVAL", "COMPLETED", "CANCELLED"]),
});

const remediationDeleteSchema = z.object({ id: z.string().min(1) });

export async function GET() {
  const { ctx, error } = await requirePermission("reports:view");
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();

  const actions = await prisma.remediationAction.findMany({
    where: { tenantId: ctx.tenantId },
    include: { payGapRow: true },
    orderBy: [{ status: "asc" }, { dueAt: "asc" }],
    take: 200,
  });
  return ok({ actions });
}

export async function POST(request: Request) {
  const { ctx, error } = await requirePermission("reports:approve");
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();

  const input = await readJson(request, remediationSchema);
  const action = await prisma.remediationAction.create({
    data: {
      tenantId: ctx.tenantId,
      payGapRowId: input.payGapRowId,
      title: input.title,
      description: input.description,
      rootCause: input.rootCause,
      objectiveReason: input.objectiveReason,
      ownerUserId: input.ownerUserId,
      dueAt: input.dueAt,
      status: "OPEN",
    },
  });
  await writeAuditLog({
    tenantId: ctx.tenantId,
    userId: ctx.user.id,
    action: "remediation.create",
    entityType: "RemediationAction",
    entityId: action.id,
    severity: "CRITICAL",
    metadata: { title: action.title, dueAt: action.dueAt.toISOString(), payGapRowId: action.payGapRowId },
  });
  return ok({ actionId: action.id });
}

export async function PATCH(request: Request) {
  const { ctx, error } = await requirePermission("reports:approve");
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();
  const input = await readJson(request, remediationUpdateSchema);
  const existing = await prisma.remediationAction.findFirst({ where: { id: input.id, tenantId: ctx.tenantId } });
  if (!existing) return badRequest("Massnahme nicht gefunden");
  const { id, payGapRowId, rootCause, objectiveReason, ownerUserId, ...rest } = input;
  const action = await prisma.remediationAction.update({
    where: { id },
    data: {
      ...rest,
      payGapRowId: payGapRowId ?? null,
      rootCause: rootCause ?? null,
      objectiveReason: objectiveReason ?? null,
      ownerUserId: ownerUserId ?? null,
      completedAt: input.status === "COMPLETED" ? (existing.completedAt ?? new Date()) : null,
    },
  });
  await writeAuditLog({
    tenantId: ctx.tenantId,
    userId: ctx.user.id,
    action: "remediation.update",
    entityType: "RemediationAction",
    entityId: action.id,
    severity: "WARNING",
    metadata: { title: action.title, status: action.status },
  });
  return ok({ actionId: action.id });
}

export async function DELETE(request: Request) {
  const { ctx, error } = await requirePermission("reports:approve");
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();
  const { id } = await readJson(request, remediationDeleteSchema);
  const existing = await prisma.remediationAction.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!existing) return badRequest("Massnahme nicht gefunden");
  await prisma.remediationAction.delete({ where: { id } });
  await writeAuditLog({
    tenantId: ctx.tenantId,
    userId: ctx.user.id,
    action: "remediation.delete",
    entityType: "RemediationAction",
    entityId: id,
    severity: "WARNING",
    metadata: { title: existing.title },
  });
  return ok({ deleted: id });
}
