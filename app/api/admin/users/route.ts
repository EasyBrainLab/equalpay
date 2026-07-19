import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/security/password";
import { badRequest, forbidden, ok, readJson, unauthorized } from "@/lib/server/api";
import { requirePermission } from "@/lib/server/context";
import { writeAuditLog } from "@/lib/server/audit";

const userSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  authProvider: z.enum(["LOCAL", "AZURE_AD"]).default("LOCAL"),
  azureObjectId: z.string().optional(),
  password: z.string().min(12).optional(),
  role: z
    .enum([
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
    ])
    .optional(),
});

export async function POST(request: Request) {
  const { ctx, error } = await requirePermission("system:admin");
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();

  const input = await readJson(request, userSchema);
  if (input.authProvider === "LOCAL" && !input.password) {
    return badRequest("Lokale Benutzer benoetigen ein Startpasswort mit mindestens 12 Zeichen.");
  }

  const passwordHash = input.authProvider === "LOCAL" && input.password ? await hashPassword(input.password) : null;
  const user = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: ctx.tenantId, email: input.email.toLowerCase() } },
    update: {
      name: input.name,
      authProvider: input.authProvider,
      azureObjectId: input.azureObjectId,
      passwordHash,
      status: "ACTIVE",
    },
    create: {
      tenantId: ctx.tenantId,
      email: input.email.toLowerCase(),
      name: input.name,
      authProvider: input.authProvider,
      azureObjectId: input.azureObjectId,
      passwordHash,
      mfaRequired: input.authProvider === "AZURE_AD",
      status: "ACTIVE",
    },
  });

  if (input.role) {
    const existing = await prisma.roleAssignment.findFirst({
      where: { tenantId: ctx.tenantId, userId: user.id, role: input.role },
    });
    if (!existing) {
      await prisma.roleAssignment.create({
        data: { tenantId: ctx.tenantId, userId: user.id, role: input.role, createdById: ctx.user.id },
      });
    }
  }

  await writeAuditLog({
    tenantId: ctx.tenantId,
    userId: ctx.user.id,
    action: "admin.user.upsert",
    entityType: "User",
    entityId: user.id,
    severity: "WARNING",
    metadata: { email: user.email, authProvider: user.authProvider, initialRole: input.role ?? null },
  });

  return ok({ userId: user.id });
}
