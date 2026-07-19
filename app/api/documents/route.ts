import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { forbidden, ok, readJson, unauthorized } from "@/lib/server/api";
import { requirePermission } from "@/lib/server/context";
import { writeAuditLog } from "@/lib/server/audit";

const documentSchema = z.object({
  title: z.string().min(1),
  type: z.enum(["POLICY", "WORKS_AGREEMENT", "JOB_PROFILE", "LEGAL_MEMO", "REPORT", "OFFER", "TEMPLATE", "OTHER"]),
  sensitivity: z
    .enum(["PUBLIC_CONFIG", "HR_STRUCTURAL", "PERSONAL_BASIC", "PERSONAL_SENSITIVE", "PAY_SENSITIVE", "PAY_ANALYTICS", "LEGAL_CONFIDENTIAL", "SECURITY"])
    .default("HR_STRUCTURAL"),
});

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
