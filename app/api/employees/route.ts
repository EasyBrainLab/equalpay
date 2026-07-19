import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { forbidden, ok, readJson, unauthorized } from "@/lib/server/api";
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
