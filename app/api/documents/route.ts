import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { badRequest, forbidden, ok, readJson, unauthorized } from "@/lib/server/api";
import { requirePermission } from "@/lib/server/context";
import { writeAuditLog } from "@/lib/server/audit";

const documentTypeEnum = z.enum(["POLICY", "WORKS_AGREEMENT", "JOB_PROFILE", "LEGAL_MEMO", "REPORT", "OFFER", "TEMPLATE", "OTHER"]);
const sensitivityEnum = z.enum([
  "PUBLIC_CONFIG", "HR_STRUCTURAL", "PERSONAL_BASIC", "PERSONAL_SENSITIVE", "PAY_SENSITIVE", "PAY_ANALYTICS", "LEGAL_CONFIDENTIAL", "SECURITY",
]);

const documentSchema = z.object({
  title: z.string().min(1),
  type: documentTypeEnum,
  sensitivity: sensitivityEnum.default("HR_STRUCTURAL"),
});

const documentUpdateSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  type: documentTypeEnum,
  sensitivity: sensitivityEnum,
});

const documentDeleteSchema = z.object({ id: z.string().min(1) });

export async function GET() {
  const { ctx, error } = await requirePermission("documents:view");
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();
  const documents = await prisma.document.findMany({
    where: { tenantId: ctx.tenantId },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    orderBy: { updatedAt: "desc" },
  });
  return ok({ documents });
}

export async function POST(request: Request) {
  const { ctx, error } = await requirePermission("documents:edit");
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();
  const input = await readJson(request, documentSchema);
  const document = await prisma.document.create({ data: { ...input, tenantId: ctx.tenantId } });
  await writeAuditLog({
    tenantId: ctx.tenantId,
    userId: ctx.user.id,
    action: "document.create",
    entityType: "Document",
    entityId: document.id,
    severity: input.sensitivity.includes("PAY") || input.sensitivity.includes("LEGAL") ? "WARNING" : "INFO",
    metadata: { title: document.title, type: document.type, sensitivity: document.sensitivity },
  });
  return ok({ document });
}

export async function PATCH(request: Request) {
  const { ctx, error } = await requirePermission("documents:edit");
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();
  const input = await readJson(request, documentUpdateSchema);
  const existing = await prisma.document.findFirst({ where: { id: input.id, tenantId: ctx.tenantId } });
  if (!existing) return badRequest("Dokument nicht gefunden");
  const { id, ...data } = input;
  const document = await prisma.document.update({ where: { id }, data });
  await writeAuditLog({
    tenantId: ctx.tenantId,
    userId: ctx.user.id,
    action: "document.update",
    entityType: "Document",
    entityId: document.id,
    severity: document.sensitivity.includes("PAY") || document.sensitivity.includes("LEGAL") ? "WARNING" : "INFO",
    metadata: { title: document.title, type: document.type, sensitivity: document.sensitivity },
  });
  return ok({ document });
}

export async function DELETE(request: Request) {
  const { ctx, error } = await requirePermission("documents:edit");
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();
  const { id } = await readJson(request, documentDeleteSchema);
  const existing = await prisma.document.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!existing) return badRequest("Dokument nicht gefunden");
  await prisma.document.delete({ where: { id } });
  await writeAuditLog({
    tenantId: ctx.tenantId,
    userId: ctx.user.id,
    action: "document.delete",
    entityType: "Document",
    entityId: id,
    severity: "WARNING",
    metadata: { title: existing.title, type: existing.type },
  });
  return ok({ deleted: id });
}
