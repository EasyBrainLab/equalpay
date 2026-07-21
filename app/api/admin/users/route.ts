import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { hashPassword, validatePasswordPolicy } from "@/lib/security/password";
import { badRequest, forbidden, ok, readJson, unauthorized } from "@/lib/server/api";
import { requirePermission } from "@/lib/server/context";
import { writeAuditLog } from "@/lib/server/audit";

const roleValues = [
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
] as const;

const userSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  authProvider: z.enum(["LOCAL", "AZURE_AD"]).default("LOCAL"),
  azureObjectId: z.string().optional(),
  password: z.string().min(12).optional(),
  role: z.enum(roleValues).optional(),
});

const userUpdateSchema = z.object({
  userId: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1),
  authProvider: z.enum(["LOCAL", "AZURE_AD"]),
  azureObjectId: z.string().optional(),
  status: z.enum(["ACTIVE", "INVITED", "DISABLED"]),
  roles: z.array(z.enum(roleValues)).default([]),
});

const passwordResetSchema = z.object({
  action: z.literal("resetPassword"),
  userId: z.string().min(1),
  password: z.string().min(12),
});

const deleteSchema = z.object({
  userId: z.string().min(1),
});

function passwordPolicyError(password: string): string | null {
  const errors = validatePasswordPolicy(password);
  return errors.length ? errors.join(" ") : null;
}

function hasAdminRole(roles: readonly string[]): boolean {
  return roles.includes("SYSTEM_ADMIN") || roles.includes("HR_ADMIN");
}

async function otherActiveAdminCount(tenantId: string, userId: string): Promise<number> {
  return prisma.user.count({
    where: {
      tenantId,
      id: { not: userId },
      status: "ACTIVE",
      roles: { some: { role: { in: ["SYSTEM_ADMIN", "HR_ADMIN"] } } },
    },
  });
}

function toOptionalText(value: string | undefined): string | null {
  const text = value?.trim();
  return text ? text : null;
}

function prismaErrorMessage(error: unknown): string | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return "E-Mail-Adresse ist bereits vergeben.";
  }
  return null;
}

export async function POST(request: Request) {
  const { ctx, error } = await requirePermission("users:admin");
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();

  const input = await readJson(request, userSchema);
  if (input.authProvider === "LOCAL" && !input.password) {
    return badRequest("Lokale Benutzer benoetigen ein Startpasswort mit mindestens 12 Zeichen.");
  }
  if (input.password) {
    const policyError = passwordPolicyError(input.password);
    if (policyError) return badRequest(policyError);
  }

  try {
    const passwordHash = input.authProvider === "LOCAL" && input.password ? await hashPassword(input.password) : null;
    const user = await prisma.user.upsert({
      where: { tenantId_email: { tenantId: ctx.tenantId, email: input.email.toLowerCase() } },
      update: {
        name: input.name,
        authProvider: input.authProvider,
        azureObjectId: toOptionalText(input.azureObjectId),
        passwordHash,
        mfaRequired: input.authProvider === "AZURE_AD",
        status: "ACTIVE",
      },
      create: {
        tenantId: ctx.tenantId,
        email: input.email.toLowerCase(),
        name: input.name,
        authProvider: input.authProvider,
        azureObjectId: toOptionalText(input.azureObjectId),
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
  } catch (caught) {
    const message = prismaErrorMessage(caught);
    if (message) return badRequest(message);
    throw caught;
  }
}

export async function PATCH(request: Request) {
  const { ctx, error } = await requirePermission("users:admin");
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();

  const body = await request.json().catch(() => ({}));
  if (body.action === "resetPassword") {
    const input = passwordResetSchema.parse(body);
    const policyError = passwordPolicyError(input.password);
    if (policyError) return badRequest(policyError);

    const user = await prisma.user.findFirst({ where: { id: input.userId, tenantId: ctx.tenantId } });
    if (!user) return badRequest("Benutzer nicht im Mandanten gefunden.");
    if (user.authProvider !== "LOCAL") return badRequest("Passwort-Reset ist nur fuer lokale Benutzer moeglich.");

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(input.password), status: "ACTIVE" },
    });
    await prisma.session.deleteMany({ where: { userId: user.id } });
    await writeAuditLog({
      tenantId: ctx.tenantId,
      userId: ctx.user.id,
      action: "admin.user.password.reset",
      entityType: "User",
      entityId: user.id,
      severity: "CRITICAL",
      metadata: { targetEmail: user.email },
    });
    return ok({ userId: user.id, passwordReset: true });
  }

  const input = userUpdateSchema.parse(body);
  const user = await prisma.user.findFirst({ where: { id: input.userId, tenantId: ctx.tenantId }, include: { roles: true } });
  if (!user) return badRequest("Benutzer nicht im Mandanten gefunden.");
  if (ctx.user.id === user.id && (!hasAdminRole(input.roles) || input.status !== "ACTIVE")) {
    return badRequest("Der eigene aktive Adminzugriff darf nicht entfernt werden.");
  }
  if (hasAdminRole(user.roles.map((role) => role.role)) && (!hasAdminRole(input.roles) || input.status !== "ACTIVE")) {
    const otherAdmins = await otherActiveAdminCount(ctx.tenantId, user.id);
    if (otherAdmins < 1) return badRequest("Der letzte aktive Admin darf nicht deaktiviert oder entzogen werden.");
  }
  if (input.authProvider === "LOCAL" && !user.passwordHash) {
    return badRequest("Lokale Benutzer ohne Passwort muessen zuerst ein Passwort-Reset erhalten.");
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.user.update({
        where: { id: user.id },
        data: {
          email: input.email.toLowerCase(),
          name: input.name,
          authProvider: input.authProvider,
          azureObjectId: toOptionalText(input.azureObjectId),
          status: input.status,
          mfaRequired: input.authProvider === "AZURE_AD",
          passwordHash: input.authProvider === "AZURE_AD" ? null : undefined,
        },
      });
      await tx.roleAssignment.deleteMany({ where: { tenantId: ctx.tenantId, userId: user.id } });
      for (const role of input.roles) {
        await tx.roleAssignment.create({ data: { tenantId: ctx.tenantId, userId: user.id, role, createdById: ctx.user.id } });
      }
      if (input.status !== "ACTIVE") await tx.session.deleteMany({ where: { userId: user.id } });
      return saved;
    });

    await writeAuditLog({
      tenantId: ctx.tenantId,
      userId: ctx.user.id,
      action: "admin.user.update",
      entityType: "User",
      entityId: updated.id,
      severity: "CRITICAL",
      metadata: { targetEmail: updated.email, status: updated.status, roles: input.roles },
    });

    return ok({ userId: updated.id });
  } catch (caught) {
    const message = prismaErrorMessage(caught);
    if (message) return badRequest(message);
    throw caught;
  }
}

export async function DELETE(request: Request) {
  const { ctx, error } = await requirePermission("users:admin");
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();

  const input = await readJson(request, deleteSchema);
  if (input.userId === ctx.user.id) return badRequest("Der eigene Benutzer kann nicht geloescht werden.");

  const user = await prisma.user.findFirst({ where: { id: input.userId, tenantId: ctx.tenantId }, include: { roles: true } });
  if (!user) return badRequest("Benutzer nicht im Mandanten gefunden.");
  if (hasAdminRole(user.roles.map((role) => role.role))) {
    const otherAdmins = await otherActiveAdminCount(ctx.tenantId, user.id);
    if (otherAdmins < 1) return badRequest("Der letzte aktive Admin darf nicht geloescht werden.");
  }

  await prisma.user.update({ where: { id: user.id }, data: { status: "DISABLED" } });
  await prisma.session.deleteMany({ where: { userId: user.id } });
  await writeAuditLog({
    tenantId: ctx.tenantId,
    userId: ctx.user.id,
    action: "admin.user.disable",
    entityType: "User",
    entityId: user.id,
    severity: "CRITICAL",
    metadata: { targetEmail: user.email, formerStatus: user.status },
  });

  return ok({ userId: user.id, disabled: true });
}
