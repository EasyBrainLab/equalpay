import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { badRequest, forbidden, ok, readJson, unauthorized } from "@/lib/server/api";
import { requirePermission } from "@/lib/server/context";
import { writeAuditLog } from "@/lib/server/audit";

const salaryBandSchema = z.object({
  payGradeId: z.string().min(1),
  name: z.string().min(1),
  currency: z.string().default("EUR"),
  fullTimeHours: z.number().positive().default(40),
  minAmount: z.number().int().positive(),
  midAmount: z.number().int().positive(),
  maxAmount: z.number().int().positive(),
  validFrom: z.string().datetime(),
});

const updateSalaryBandSchema = z.object({
  id: z.string().min(1),
  payGradeId: z.string().min(1),
  name: z.string().min(1),
  currency: z.string().min(3).max(3),
  fullTimeHours: z.number().positive(),
  minAmount: z.number().int().positive(),
  midAmount: z.number().int().positive(),
  maxAmount: z.number().int().positive(),
  validFrom: z.string().datetime(),
  validTo: z.string().datetime().nullable().optional(),
});

const deleteSalaryBandSchema = z.object({ id: z.string().min(1) });

export async function GET() {
  const { ctx, error } = await requirePermission("pay:view");
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();
  const salaryBands = await prisma.salaryBand.findMany({
    where: { tenantId: ctx.tenantId },
    include: { payGrade: true },
    orderBy: [{ payGrade: { sortOrder: "asc" } }, { validFrom: "desc" }],
  });
  return ok({ salaryBands });
}

export async function POST(request: Request) {
  const { ctx, error } = await requirePermission("pay:edit");
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();
  const input = await readJson(request, salaryBandSchema);
  const salaryBand = await prisma.salaryBand.create({
    data: { ...input, tenantId: ctx.tenantId, validFrom: new Date(input.validFrom) },
  });
  await writeAuditLog({
    tenantId: ctx.tenantId,
    userId: ctx.user.id,
    action: "salary-band.create",
    entityType: "SalaryBand",
    entityId: salaryBand.id,
    severity: "WARNING",
    metadata: { payGradeId: salaryBand.payGradeId, name: salaryBand.name, validFrom: salaryBand.validFrom.toISOString() },
  });
  return ok({ salaryBand });
}

export async function PATCH(request: Request) {
  const { ctx, error } = await requirePermission("pay:edit");
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();
  const input = await readJson(request, updateSalaryBandSchema);
  const existing = await prisma.salaryBand.findFirst({ where: { id: input.id, tenantId: ctx.tenantId } });
  if (!existing) return badRequest("Gehaltsband nicht gefunden");
  const { id, validFrom, validTo, ...rest } = input;
  const salaryBand = await prisma.salaryBand.update({
    where: { id },
    data: {
      ...rest,
      validFrom: new Date(validFrom),
      validTo: validTo === undefined ? undefined : validTo === null ? null : new Date(validTo),
    },
  });
  await writeAuditLog({
    tenantId: ctx.tenantId,
    userId: ctx.user.id,
    action: "salary-band.update",
    entityType: "SalaryBand",
    entityId: salaryBand.id,
    severity: "WARNING",
    metadata: { payGradeId: salaryBand.payGradeId, name: salaryBand.name },
  });
  return ok({ salaryBand });
}

export async function DELETE(request: Request) {
  const { ctx, error } = await requirePermission("pay:edit");
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();
  const { id } = await readJson(request, deleteSalaryBandSchema);
  const existing = await prisma.salaryBand.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!existing) return badRequest("Gehaltsband nicht gefunden");
  await prisma.salaryBand.delete({ where: { id } });
  await writeAuditLog({
    tenantId: ctx.tenantId,
    userId: ctx.user.id,
    action: "salary-band.delete",
    entityType: "SalaryBand",
    entityId: id,
    severity: "WARNING",
    metadata: { payGradeId: existing.payGradeId, name: existing.name },
  });
  return ok({ deleted: id });
}
