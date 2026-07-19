import { prisma } from "@/lib/db/prisma";
import { calculatePayGapRows } from "@/lib/domain/pay-gap";
import { decryptField } from "@/lib/security/crypto";
import { forbidden, ok, unauthorized } from "@/lib/server/api";
import { requirePermission } from "@/lib/server/context";
import { writeAuditLog } from "@/lib/server/audit";

export async function GET() {
  const { ctx, error } = await requirePermission("analytics:view");
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();
  const analyses = await prisma.payGapAnalysis.findMany({
    where: { tenantId: ctx.tenantId },
    include: { rows: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return ok({ analyses });
}

export async function POST() {
  const { ctx, error } = await requirePermission("analytics:run");
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();
  const components = await prisma.compensationComponent.findMany({
    where: { tenantId: ctx.tenantId, type: "BASE_SALARY", validTo: null },
    include: { employee: { include: { jobProfile: { include: { comparisonGroup: true } }, payGrade: true } } },
  });
  const rows = components.map((component) => {
    const amount = Number(
      decryptField({
        ciphertext: component.amountCiphertext,
        keyId: component.amountKeyId,
        algorithm: "aes-256-gcm",
      }, `${component.tenantId}:${component.employeeId}:${component.type}`),
    );
    const groupKey =
      component.employee.jobProfile?.comparisonGroup?.code ??
      component.employee.payGrade?.code ??
      "UNASSIGNED";
    const groupLabel =
      component.employee.jobProfile?.comparisonGroup?.name ??
      component.employee.payGrade?.name ??
      "Nicht zugeordnet";
    return {
      groupKey,
      groupLabel,
      gender: component.employee.gender,
      amountCents: amount,
    };
  });
  const resultRows = calculatePayGapRows(rows);
  const analysis = await prisma.payGapAnalysis.create({
    data: {
      tenantId: ctx.tenantId,
      name: `Dry Run ${new Date().toLocaleDateString("de-DE")}`,
      dataCutDate: new Date(),
      createdById: ctx.user.id,
      rows: {
        create: resultRows.map((row) => ({
          groupKey: row.groupKey,
          groupLabel: row.groupLabel,
          employeeCount: row.employeeCount,
          femaleCount: row.femaleCount,
          maleCount: row.maleCount,
          averageGapPercent: row.averageGapPercent,
          medianGapPercent: row.medianGapPercent,
          triggerFivePercent: row.triggerFivePercent,
          unexplainedGap: row.triggerFivePercent,
        })),
      },
    },
    include: { rows: true },
  });
  await writeAuditLog({
    tenantId: ctx.tenantId,
    userId: ctx.user.id,
    action: "pay_gap.run",
    entityType: "PayGapAnalysis",
    entityId: analysis.id,
    metadata: { rows: analysis.rows.length },
  });
  return ok({ analysis });
}
