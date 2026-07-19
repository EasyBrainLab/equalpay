import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { forbidden, ok, readJson, unauthorized } from "@/lib/server/api";
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
