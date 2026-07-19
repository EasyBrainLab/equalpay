import { prisma } from "@/lib/db/prisma";
import { collectComplianceFindings } from "@/lib/domain/compliance";
import { forbidden, ok, unauthorized } from "@/lib/server/api";
import { requirePermission } from "@/lib/server/context";

export async function GET() {
  const { ctx, error } = await requirePermission("reports:view");
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();

  const findings = await collectComplianceFindings(prisma, ctx.tenantId);
  return ok({
    findings,
    critical: findings.filter((finding) => finding.status === "CRITICAL").length,
    warnings: findings.filter((finding) => finding.status === "WARN").length,
  });
}
