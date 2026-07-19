import { prisma } from "@/lib/db/prisma";
import { forbidden, ok, unauthorized } from "@/lib/server/api";
import { requirePermission } from "@/lib/server/context";

export async function GET() {
  const { ctx, error } = await requirePermission("org:view");
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();

  const [
    employeeCount,
    jobProfileCount,
    approvedJobProfileCount,
    salaryBandCount,
    disclosureOpenCount,
    criticalAuditCount,
    latestPayGap,
  ] = await Promise.all([
    prisma.employee.count({ where: { tenantId: ctx.tenantId } }),
    prisma.jobProfile.count({ where: { tenantId: ctx.tenantId } }),
    prisma.jobProfile.count({ where: { tenantId: ctx.tenantId, status: "APPROVED" } }),
    prisma.salaryBand.count({ where: { tenantId: ctx.tenantId } }),
    prisma.disclosureRequest.count({ where: { tenantId: ctx.tenantId, status: { notIn: ["ANSWERED", "CANCELLED"] } } }),
    prisma.auditLog.count({ where: { tenantId: ctx.tenantId, severity: "CRITICAL" } }),
    prisma.payGapAnalysis.findFirst({
      where: { tenantId: ctx.tenantId },
      orderBy: { createdAt: "desc" },
      include: { rows: true },
    }),
  ]);

  return ok({
    employeeCount,
    jobProfileCount,
    approvedJobProfileCount,
    salaryBandCount,
    disclosureOpenCount,
    criticalAuditCount,
    latestPayGap: latestPayGap
      ? {
          id: latestPayGap.id,
          name: latestPayGap.name,
          createdAt: latestPayGap.createdAt,
          triggerRows: latestPayGap.rows.filter((row) => row.triggerFivePercent).length,
        }
      : null,
  });
}
