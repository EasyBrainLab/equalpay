import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { createArticle9Report } from "@/lib/domain/reporting";
import { badRequest, forbidden, ok, readJson, unauthorized } from "@/lib/server/api";
import { requirePermission } from "@/lib/server/context";
import { writeAuditLog } from "@/lib/server/audit";

const reportSchema = z.object({
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  payGapAnalysisId: z.string().optional(),
});

const reportUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  status: z.enum(["DRAFT", "GENERATED", "APPROVED", "SUBMITTED", "ARCHIVED"]),
});

const reportDeleteSchema = z.object({ id: z.string().min(1) });

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

export async function PATCH(request: Request) {
  const { ctx, error } = await requirePermission("reports:approve");
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();
  const input = await readJson(request, reportUpdateSchema);
  const existing = await prisma.complianceReport.findFirst({ where: { id: input.id, tenantId: ctx.tenantId } });
  if (!existing) return badRequest("Report nicht gefunden");
  const report = await prisma.complianceReport.update({
    where: { id: input.id },
    data: {
      name: input.name,
      status: input.status,
      approvedAt: input.status === "APPROVED" ? (existing.approvedAt ?? new Date()) : existing.approvedAt,
      submittedAt: input.status === "SUBMITTED" ? (existing.submittedAt ?? new Date()) : existing.submittedAt,
    },
  });
  await writeAuditLog({
    tenantId: ctx.tenantId,
    userId: ctx.user.id,
    action: "report.update",
    entityType: "ComplianceReport",
    entityId: report.id,
    severity: "WARNING",
    metadata: { name: report.name, status: report.status },
  });
  return ok({ report });
}

export async function DELETE(request: Request) {
  const { ctx, error } = await requirePermission("reports:approve");
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();
  const { id } = await readJson(request, reportDeleteSchema);
  const existing = await prisma.complianceReport.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!existing) return badRequest("Report nicht gefunden");
  // Eingereichte (behördlich übermittelte) Reports bleiben als Nachweis erhalten.
  if (existing.status === "SUBMITTED") {
    return badRequest("Eingereichte Reports können nicht gelöscht werden (Nachweispflicht).");
  }
  await prisma.complianceReport.delete({ where: { id } });
  await writeAuditLog({
    tenantId: ctx.tenantId,
    userId: ctx.user.id,
    action: "report.delete",
    entityType: "ComplianceReport",
    entityId: id,
    severity: "CRITICAL",
    metadata: { name: existing.name, type: existing.type },
  });
  return ok({ deleted: id });
}
