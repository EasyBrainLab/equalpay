import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { badRequest, forbidden, ok, readJson, unauthorized } from "@/lib/server/api";
import { requirePermission } from "@/lib/server/context";
import { writeAuditLog } from "@/lib/server/audit";

const createEmployeeSchema = z.object({
  employeeNumber: z.string().min(1),
  displayName: z.string().min(1),
  pseudonym: z.string().min(1),
  companyId: z.string().min(1),
  segmentId: z.string().optional(),
  siteId: z.string().optional(),
  departmentId: z.string().optional(),
  gender: z.enum(["FEMALE", "MALE", "DIVERSE", "NOT_DISCLOSED", "UNKNOWN"]).default("UNKNOWN"),
  fte: z.number().positive().default(1),
  weeklyHours: z.number().positive().default(40),
  fullTimeHours: z.number().positive().default(40),
  jobProfileId: z.string().optional(),
  payGradeId: z.string().optional(),
});

// Beim Ändern: null = Zuordnung entfernen, undefined = unverändert lassen.
const updateEmployeeSchema = z.object({
  id: z.string().min(1),
  employeeNumber: z.string().min(1),
  displayName: z.string().min(1),
  pseudonym: z.string().min(1),
  companyId: z.string().min(1),
  segmentId: z.string().nullable().optional(),
  siteId: z.string().nullable().optional(),
  departmentId: z.string().nullable().optional(),
  gender: z.enum(["FEMALE", "MALE", "DIVERSE", "NOT_DISCLOSED", "UNKNOWN"]),
  status: z.enum(["ACTIVE", "LEAVE", "TERMINATED"]),
  fte: z.number().positive(),
  weeklyHours: z.number().positive(),
  fullTimeHours: z.number().positive(),
  jobProfileId: z.string().nullable().optional(),
  payGradeId: z.string().nullable().optional(),
});

const deleteEmployeeSchema = z.object({ id: z.string().min(1) });

export async function GET() {
  const { ctx, error } = await requirePermission("employees:view");
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();
  const employees = await prisma.employee.findMany({
    where: { tenantId: ctx.tenantId },
    include: { company: true, segment: true, department: true, jobProfile: true, payGrade: true },
    orderBy: [{ company: { name: "asc" } }, { displayName: "asc" }],
    take: 250,
  });
  return ok({ employees });
}

export async function POST(request: Request) {
  const { ctx, error } = await requirePermission("employees:edit");
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();
  const input = await readJson(request, createEmployeeSchema);
  const employee = await prisma.employee.create({
    data: {
      tenantId: ctx.tenantId,
      companyId: input.companyId,
      segmentId: input.segmentId,
      siteId: input.siteId,
      departmentId: input.departmentId,
      employeeNumber: input.employeeNumber,
      displayName: input.displayName,
      pseudonym: input.pseudonym,
      gender: input.gender,
      fte: input.fte,
      weeklyHours: input.weeklyHours,
      fullTimeHours: input.fullTimeHours,
      jobProfileId: input.jobProfileId,
      payGradeId: input.payGradeId,
    },
  });
  await writeAuditLog({
    tenantId: ctx.tenantId,
    userId: ctx.user.id,
    action: "employee.create",
    entityType: "Employee",
    entityId: employee.id,
    severity: "WARNING",
    metadata: { employeeNumber: employee.employeeNumber, pseudonym: employee.pseudonym },
  });
  return ok({ employee });
}

export async function PATCH(request: Request) {
  const { ctx, error } = await requirePermission("employees:edit");
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();
  const input = await readJson(request, updateEmployeeSchema);
  // Tenant-Scope: nur eigene Datensätze; verhindert mandantenübergreifende Änderung.
  const existing = await prisma.employee.findFirst({ where: { id: input.id, tenantId: ctx.tenantId } });
  if (!existing) return badRequest("Mitarbeiter nicht gefunden");
  const { id, ...data } = input;
  try {
    const employee = await prisma.employee.update({ where: { id }, data });
    await writeAuditLog({
      tenantId: ctx.tenantId,
      userId: ctx.user.id,
      action: "employee.update",
      entityType: "Employee",
      entityId: employee.id,
      severity: "WARNING",
      metadata: { employeeNumber: employee.employeeNumber, status: employee.status },
    });
    return ok({ employee });
  } catch (caught) {
    if (caught instanceof Prisma.PrismaClientKnownRequestError && caught.code === "P2002") {
      return badRequest("Personalnummer ist bereits vergeben.");
    }
    throw caught;
  }
}

export async function DELETE(request: Request) {
  const { ctx, error } = await requirePermission("employees:edit");
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();
  const { id } = await readJson(request, deleteEmployeeSchema);
  const existing = await prisma.employee.findFirst({
    where: { id, tenantId: ctx.tenantId },
    include: { _count: { select: { compensation: true } } },
  });
  if (!existing) return badRequest("Mitarbeiter nicht gefunden");
  // Löschschutz: Beschäftigte mit Vergütungshistorie werden nicht hart gelöscht
  // (Nachweis-/Aufbewahrungspflicht) — stattdessen Status auf TERMINATED setzen.
  if (existing._count.compensation > 0) {
    return badRequest(
      "Mitarbeiter hat dokumentierte Vergütungsdaten und kann nicht gelöscht werden. Bitte stattdessen den Status auf TERMINATED setzen.",
    );
  }
  await prisma.employee.delete({ where: { id } });
  await writeAuditLog({
    tenantId: ctx.tenantId,
    userId: ctx.user.id,
    action: "employee.delete",
    entityType: "Employee",
    entityId: id,
    severity: "CRITICAL",
    metadata: { employeeNumber: existing.employeeNumber },
  });
  return ok({ deleted: id });
}
