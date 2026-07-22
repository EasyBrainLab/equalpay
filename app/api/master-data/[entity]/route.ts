import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { Permission } from "@/lib/security/permissions";
import { badRequest, forbidden, ok, readJson, unauthorized } from "@/lib/server/api";
import { requirePermission } from "@/lib/server/context";
import { writeAuditLog } from "@/lib/server/audit";

// Generischer CRUD-Endpunkt für die Stammdaten der Org-/Job-Architektur, die
// bisher keine Schreib-API hatten. Jeder Eintrag ist tenant-scoped, permission-
// geschützt und wird im Audit protokolliert. HR_ADMIN besitzt sowohl org:edit
// als auch job:edit und kann damit alle Stammdaten pflegen.

type EntityDef = {
  model: string; // Prisma-Delegate
  permission: Permission;
  label: string;
  schema: z.ZodObject<z.ZodRawShape>;
};

const REGISTRY: Record<string, EntityDef> = {
  companies: {
    model: "company",
    permission: "org:edit",
    label: "Company",
    schema: z.object({ name: z.string().min(1), code: z.string().min(1), country: z.string().min(2).max(2).default("DE") }),
  },
  segments: {
    model: "segment",
    permission: "org:edit",
    label: "Segment",
    schema: z.object({ name: z.string().min(1), code: z.string().min(1), companyId: z.string().nullable().optional() }),
  },
  sites: {
    model: "site",
    permission: "org:edit",
    label: "Site",
    schema: z.object({ name: z.string().min(1), code: z.string().min(1), companyId: z.string().min(1) }),
  },
  departments: {
    model: "department",
    permission: "org:edit",
    label: "Department",
    schema: z.object({ name: z.string().min(1), code: z.string().min(1), companyId: z.string().min(1) }),
  },
  "job-families": {
    model: "jobFamily",
    permission: "job:edit",
    label: "JobFamily",
    schema: z.object({ name: z.string().min(1), code: z.string().min(1), description: z.string().nullable().optional() }),
  },
  "pay-grades": {
    model: "payGrade",
    permission: "job:edit",
    label: "PayGrade",
    schema: z.object({
      code: z.string().min(1),
      name: z.string().min(1),
      minPoints: z.number().int(),
      maxPoints: z.number().int(),
      sortOrder: z.number().int(),
      description: z.string().nullable().optional(),
    }),
  },
  "comparison-groups": {
    model: "comparisonGroup",
    permission: "job:edit",
    label: "ComparisonGroup",
    schema: z.object({ code: z.string().min(1), name: z.string().min(1), description: z.string().nullable().optional() }),
  },
  "evaluation-criteria": {
    model: "evaluationCriterion",
    permission: "job:edit",
    label: "EvaluationCriterion",
    schema: z.object({
      key: z.string().min(1),
      name: z.string().min(1),
      weight: z.number().int(),
      sortOrder: z.number().int(),
      description: z.string().nullable().optional(),
    }),
  },
};

/* eslint-disable @typescript-eslint/no-explicit-any */
function delegate(model: string): any {
  return (prisma as any)[model];
}

function prismaError(caught: unknown) {
  if (caught instanceof Prisma.PrismaClientKnownRequestError) {
    if (caught.code === "P2002") return badRequest("Code/Schlüssel ist in diesem Mandanten bereits vergeben.");
    if (caught.code === "P2003") return badRequest("Der Eintrag wird noch von anderen Datensätzen referenziert und kann nicht gelöscht werden.");
    if (caught.code === "P2025") return badRequest("Eintrag nicht gefunden.");
  }
  throw caught;
}

function metaOf(input: Record<string, unknown>) {
  return { code: input.code ?? input.key ?? null, name: input.name ?? null };
}

export async function POST(request: Request, { params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params;
  const def = REGISTRY[entity];
  if (!def) return badRequest("Unbekannte Stammdaten-Entität");
  const { ctx, error } = await requirePermission(def.permission);
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();
  const input = await readJson(request, def.schema);
  try {
    const item = await delegate(def.model).create({ data: { tenantId: ctx.tenantId, ...input } });
    await writeAuditLog({
      tenantId: ctx.tenantId,
      userId: ctx.user.id,
      action: `master-data.${entity}.create`,
      entityType: def.label,
      entityId: item.id,
      severity: "INFO",
      metadata: metaOf(input),
    });
    return ok({ item });
  } catch (caught) {
    return prismaError(caught);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params;
  const def = REGISTRY[entity];
  if (!def) return badRequest("Unbekannte Stammdaten-Entität");
  const { ctx, error } = await requirePermission(def.permission);
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();
  const input = await readJson(request, def.schema.extend({ id: z.string().min(1) }));
  const { id, ...data } = input as { id: string } & Record<string, unknown>;
  const existing = await delegate(def.model).findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!existing) return badRequest("Eintrag nicht gefunden");
  try {
    const item = await delegate(def.model).update({ where: { id }, data });
    await writeAuditLog({
      tenantId: ctx.tenantId,
      userId: ctx.user.id,
      action: `master-data.${entity}.update`,
      entityType: def.label,
      entityId: item.id,
      severity: "INFO",
      metadata: metaOf(data),
    });
    return ok({ item });
  } catch (caught) {
    return prismaError(caught);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params;
  const def = REGISTRY[entity];
  if (!def) return badRequest("Unbekannte Stammdaten-Entität");
  const { ctx, error } = await requirePermission(def.permission);
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();
  const { id } = await readJson(request, z.object({ id: z.string().min(1) }));
  const existing = await delegate(def.model).findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!existing) return badRequest("Eintrag nicht gefunden");
  try {
    await delegate(def.model).delete({ where: { id } });
  } catch (caught) {
    return prismaError(caught);
  }
  await writeAuditLog({
    tenantId: ctx.tenantId,
    userId: ctx.user.id,
    action: `master-data.${entity}.delete`,
    entityType: def.label,
    entityId: id,
    severity: "WARNING",
    metadata: { id },
  });
  return ok({ deleted: id });
}
