import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { badRequest, forbidden, ok, readJson, unauthorized } from "@/lib/server/api";
import { requirePermission } from "@/lib/server/context";
import { writeAuditLog } from "@/lib/server/audit";

const disclosureSchema = z.object({
  requesterLabel: z.string().min(1),
  employeeId: z.string().optional(),
  comparisonGroup: z.string().optional(),
  notes: z.string().optional(),
});

const disclosureUpdateSchema = z.object({
  id: z.string().min(1),
  requesterLabel: z.string().min(1),
  employeeId: z.string().nullable().optional(),
  comparisonGroup: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  status: z.enum(["RECEIVED", "IN_REVIEW", "WAITING_FOR_LEGAL", "READY", "ANSWERED", "OVERDUE", "CANCELLED"]),
  dueAt: z.coerce.date(),
});

const disclosureDeleteSchema = z.object({ id: z.string().min(1) });

export async function GET() {
  const { ctx, error } = await requirePermission("disclosure:view");
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();
  const requests = await prisma.disclosureRequest.findMany({
    where: { tenantId: ctx.tenantId },
    orderBy: [{ status: "asc" }, { dueAt: "asc" }],
  });
  return ok({ requests });
}

export async function POST(request: Request) {
  const { ctx, error } = await requirePermission("disclosure:edit");
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();
  const input = await readJson(request, disclosureSchema);
  const dueAt = new Date();
  dueAt.setMonth(dueAt.getMonth() + 2);
  const disclosure = await prisma.disclosureRequest.create({
    data: {
      tenantId: ctx.tenantId,
      requesterLabel: input.requesterLabel,
      employeeId: input.employeeId,
      comparisonGroup: input.comparisonGroup,
      notes: input.notes,
      dueAt,
    },
  });
  return ok({ disclosure });
}

export async function PATCH(request: Request) {
  const { ctx, error } = await requirePermission("disclosure:edit");
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();
  const input = await readJson(request, disclosureUpdateSchema);
  const existing = await prisma.disclosureRequest.findFirst({ where: { id: input.id, tenantId: ctx.tenantId } });
  if (!existing) return badRequest("Auskunftsersuchen nicht gefunden");
  const { id, employeeId, comparisonGroup, notes, ...rest } = input;
  const disclosure = await prisma.disclosureRequest.update({
    where: { id },
    data: {
      ...rest,
      employeeId: employeeId ?? null,
      comparisonGroup: comparisonGroup ?? null,
      notes: notes ?? null,
    },
  });
  await writeAuditLog({
    tenantId: ctx.tenantId,
    userId: ctx.user.id,
    action: "disclosure-request.update",
    entityType: "DisclosureRequest",
    entityId: disclosure.id,
    severity: "WARNING",
    metadata: { status: disclosure.status, requesterLabel: disclosure.requesterLabel },
  });
  return ok({ disclosure });
}

export async function DELETE(request: Request) {
  const { ctx, error } = await requirePermission("disclosure:edit");
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();
  const { id } = await readJson(request, disclosureDeleteSchema);
  const existing = await prisma.disclosureRequest.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!existing) return badRequest("Auskunftsersuchen nicht gefunden");
  await prisma.disclosureRequest.delete({ where: { id } });
  await writeAuditLog({
    tenantId: ctx.tenantId,
    userId: ctx.user.id,
    action: "disclosure-request.delete",
    entityType: "DisclosureRequest",
    entityId: id,
    severity: "WARNING",
    metadata: { requesterLabel: existing.requesterLabel },
  });
  return ok({ deleted: id });
}
