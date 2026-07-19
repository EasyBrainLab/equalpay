import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { decryptField, encryptField, moneyLast4 } from "@/lib/security/crypto";
import { hasPermission } from "@/lib/security/permissions";
import { forbidden, ok, readJson, unauthorized } from "@/lib/server/api";
import { requirePermission } from "@/lib/server/context";
import { writeAuditLog } from "@/lib/server/audit";
import { formatMoney } from "@/lib/domain/money";

const compensationSchema = z.object({
  employeeId: z.string().min(1),
  type: z.enum([
    "BASE_SALARY",
    "VARIABLE_PAY",
    "BONUS",
    "ALLOWANCE",
    "BENEFIT",
    "COMPANY_CAR",
    "PENSION",
    "SPECIAL_PAYMENT",
    "ONE_TIME_PAYMENT",
  ]),
  label: z.string().min(1),
  amountCents: z.number().int(),
  currency: z.string().length(3).default("EUR"),
  validFrom: z.coerce.date(),
  validTo: z.coerce.date().optional(),
  legalBasis: z.string().optional(),
  objectiveReason: z.string().optional(),
});

export async function GET() {
  const { ctx, error } = await requirePermission("pay:view");
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();

  const canDecrypt = hasPermission(ctx.roles, "pay:decrypt");
  const components = await prisma.compensationComponent.findMany({
    where: { tenantId: ctx.tenantId },
    include: {
      employee: {
        select: {
          id: true,
          employeeNumber: true,
          displayName: true,
          pseudonym: true,
          payGrade: { select: { code: true } },
          jobProfile: { select: { title: true } },
        },
      },
    },
    orderBy: [{ employee: { displayName: "asc" } }, { validFrom: "desc" }],
    take: 500,
  });

  if (canDecrypt) {
    await writeAuditLog({
      tenantId: ctx.tenantId,
      userId: ctx.user.id,
      action: "compensation.decrypt.list",
      entityType: "CompensationComponent",
      severity: "WARNING",
      metadata: { count: components.length },
    });
  }

  return ok({
    compensation: components.map((component) => {
      const amountCents = canDecrypt
        ? Number(
            decryptField(
              { ciphertext: component.amountCiphertext, keyId: component.amountKeyId, algorithm: "aes-256-gcm" },
              `${ctx.tenantId}:${component.employeeId}:${component.type}`,
            ),
          )
        : null;
      return {
        id: component.id,
        employee: component.employee,
        type: component.type,
        label: component.label,
        currency: component.currency,
        validFrom: component.validFrom,
        validTo: component.validTo,
        approvalStatus: component.approvalStatus,
        objectiveReason: component.objectiveReason,
        legalBasis: component.legalBasis,
        amountLast4: component.amountLast4,
        amountDisplay: amountCents === null ? "verschluesselt" : formatMoney(amountCents, component.currency),
      };
    }),
  });
}

export async function POST(request: Request) {
  const { ctx, error } = await requirePermission("pay:edit");
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();

  const input = await readJson(request, compensationSchema);
  const employee = await prisma.employee.findFirst({
    where: { id: input.employeeId, tenantId: ctx.tenantId },
    select: { id: true },
  });
  if (!employee) return forbidden("Mitarbeitender nicht im Mandanten gefunden");

  const encrypted = encryptField(String(input.amountCents), `${ctx.tenantId}:${input.employeeId}:${input.type}`);
  const component = await prisma.compensationComponent.create({
    data: {
      tenantId: ctx.tenantId,
      employeeId: input.employeeId,
      type: input.type,
      label: input.label,
      amountCiphertext: encrypted.ciphertext,
      amountKeyId: encrypted.keyId,
      amountLast4: moneyLast4(input.amountCents),
      currency: input.currency,
      validFrom: input.validFrom,
      validTo: input.validTo,
      legalBasis: input.legalBasis,
      objectiveReason: input.objectiveReason,
      approvalStatus: "PENDING",
    },
  });

  await writeAuditLog({
    tenantId: ctx.tenantId,
    userId: ctx.user.id,
    action: "compensation.create",
    entityType: "CompensationComponent",
    entityId: component.id,
    severity: "WARNING",
    metadata: { type: input.type, employeeId: input.employeeId, amountLast4: component.amountLast4 },
  });

  return ok({ componentId: component.id, approvalStatus: component.approvalStatus });
}
