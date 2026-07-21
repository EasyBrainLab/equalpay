import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { badRequest, forbidden, ok, readJson, unauthorized } from "@/lib/server/api";
import { requirePermission } from "@/lib/server/context";
import { writeAuditLog } from "@/lib/server/audit";

const roleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum([
    "SYSTEM_ADMIN",
    "SECURITY_ADMIN",
    "HR_ADMIN",
    "HR_ANALYST",
    "COMPENSATION_MANAGER",
    "HR_VIEWER",
    "LEGAL_REVIEWER",
    "EMPLOYEE_REP_REVIEWER",
    "MANAGER_CONTRIBUTOR",
    "AUDITOR",
    "IMPORT_OPERATOR",
  ]),
});

export async function POST(request: Request) {
  const { ctx, error } = await requirePermission("users:admin");
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();

  const input = await readJson(request, roleSchema);
  const user = await prisma.user.findFirst({ where: { id: input.userId, tenantId: ctx.tenantId } });
  if (!user) return badRequest("Benutzer nicht im Mandanten gefunden.");

  const existing = await prisma.roleAssignment.findFirst({
    where: { tenantId: ctx.tenantId, userId: input.userId, role: input.role },
  });
  if (existing) return ok({ roleAssignmentId: existing.id, duplicate: true });

  const roleAssignment = await prisma.roleAssignment.create({
    data: {
      tenantId: ctx.tenantId,
      userId: input.userId,
      role: input.role,
      createdById: ctx.user.id,
    },
  });

  await writeAuditLog({
    tenantId: ctx.tenantId,
    userId: ctx.user.id,
    action: "admin.role.assign",
    entityType: "RoleAssignment",
    entityId: roleAssignment.id,
    severity: "CRITICAL",
    metadata: { targetUserId: input.userId, targetEmail: user.email, role: input.role },
  });

  return ok({ roleAssignmentId: roleAssignment.id, duplicate: false });
}
