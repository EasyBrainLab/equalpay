import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { decryptField } from "@/lib/security/crypto";
import { forbidden, unauthorized } from "@/lib/server/api";
import { requirePermission } from "@/lib/server/context";
import { writeAuditLog } from "@/lib/server/audit";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requirePermission("reports:view");
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();

  const { id } = await params;
  const report = await prisma.complianceReport.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!report?.exportCipher) return forbidden("Report nicht gefunden oder ohne Exportartefakt.");

  const csv = decryptField(
    { ciphertext: report.exportCipher, keyId: "local-master-key-v1", algorithm: "aes-256-gcm" },
    `${ctx.tenantId}:ARTICLE_9:${report.periodStart.toISOString()}:${report.periodEnd.toISOString()}`,
  );
  await writeAuditLog({
    tenantId: ctx.tenantId,
    userId: ctx.user.id,
    action: "report.download",
    entityType: "ComplianceReport",
    entityId: report.id,
    severity: "WARNING",
    metadata: { type: report.type, checksum: report.exportChecksumSha256 },
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${report.name.replace(/[^a-z0-9-]+/gi, "_")}.csv"`,
    },
  });
}
