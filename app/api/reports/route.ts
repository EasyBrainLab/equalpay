import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { createArticle9Report } from "@/lib/domain/reporting";
import { forbidden, ok, readJson, unauthorized } from "@/lib/server/api";
import { requirePermission } from "@/lib/server/context";
import { writeAuditLog } from "@/lib/server/audit";

const reportSchema = z.object({
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  payGapAnalysisId: z.string().optional(),
});

export async function GET() {
  const { ctx, error } = await requirePermission("reports:view");
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();

  const reports = await prisma.complianceReport.findMany({
    where: { tenantId: ctx.tenantId },
    orderBy: { generatedAt: "desc" },
    take: 100,
  });
  return ok({ reports });
}

export async function POST(request: Request) {
  const { ctx, error } = await requirePermission("reports:approve");
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();

  const input = await readJson(request, reportSchema);
  const report = await createArticle9Report(prisma, ctx.tenantId, ctx.user.id, input.periodStart, input.periodEnd, input.payGapAnalysisId);
  await writeAuditLog({
    tenantId: ctx.tenantId,
    userId: ctx.user.id,
    action: "report.article9.generate",
    entityType: "ComplianceReport",
    entityId: report.id,
    severity: "WARNING",
    metadata: { periodStart: input.periodStart.toISOString(), periodEnd: input.periodEnd.toISOString(), checksum: report.exportChecksumSha256 },
  });
  return ok({ reportId: report.id, checksum: report.exportChecksumSha256 });
}
