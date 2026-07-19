import { prisma } from "@/lib/db/prisma";
import { parseDelimited } from "@/lib/domain/simple-csv";
import { badRequest, forbidden, ok, unauthorized } from "@/lib/server/api";
import { requirePermission } from "@/lib/server/context";
import { writeAuditLog } from "@/lib/server/audit";

export async function POST(request: Request) {
  const { ctx, error } = await requirePermission("employees:edit");
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return badRequest("CSV-Datei fehlt.");
  const rows = parseDelimited(Buffer.from(await file.arrayBuffer()).toString("utf8"));

  const batch = await prisma.importBatch.create({
    data: { tenantId: ctx.tenantId, type: "EMPLOYEES_CSV", fileName: file.name, rowCount: rows.length, createdById: ctx.user.id },
  });

  let accepted = 0;
  let rejected = 0;
  for (const row of rows) {
    const employeeNumber = row.employeeNumber || row.personalnummer || row.Personalnummer;
    const displayName = row.displayName || row.name || row.Name;
    const companyCode = row.companyCode || row.Gesellschaft || row.company;
    if (!employeeNumber || !displayName || !companyCode) {
      rejected += 1;
      continue;
    }
    const company = await prisma.company.findFirst({ where: { tenantId: ctx.tenantId, code: companyCode } });
    if (!company) {
      rejected += 1;
      continue;
    }
    await prisma.employee.upsert({
      where: { tenantId_employeeNumber: { tenantId: ctx.tenantId, employeeNumber } },
      update: {
        displayName,
        pseudonym: row.pseudonym || employeeNumber,
        companyId: company.id,
        gender: (row.gender || "UNKNOWN") as "UNKNOWN",
        fte: Number(row.fte || 1),
        weeklyHours: Number(row.weeklyHours || 40),
        fullTimeHours: Number(row.fullTimeHours || 40),
      },
      create: {
        tenantId: ctx.tenantId,
        employeeNumber,
        displayName,
        pseudonym: row.pseudonym || employeeNumber,
        companyId: company.id,
        gender: (row.gender || "UNKNOWN") as "UNKNOWN",
        fte: Number(row.fte || 1),
        weeklyHours: Number(row.weeklyHours || 40),
        fullTimeHours: Number(row.fullTimeHours || 40),
      },
    });
    accepted += 1;
  }

  await prisma.importBatch.update({
    where: { id: batch.id },
    data: { acceptedCount: accepted, rejectedCount: rejected, status: rejected ? "COMPLETED_WITH_ERRORS" : "COMPLETED", completedAt: new Date() },
  });
  await writeAuditLog({
    tenantId: ctx.tenantId,
    userId: ctx.user.id,
    action: "import.employees",
    entityType: "ImportBatch",
    entityId: batch.id,
    severity: rejected ? "WARNING" : "INFO",
    metadata: { fileName: file.name, rows: rows.length, accepted, rejected },
  });

  return ok({ batchId: batch.id, rowCount: rows.length, accepted, rejected });
}
