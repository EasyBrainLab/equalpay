import { prisma } from "@/lib/db/prisma";
import { generateDisclosureResponse } from "@/lib/domain/disclosure";
import { forbidden, ok, unauthorized } from "@/lib/server/api";
import { requirePermission } from "@/lib/server/context";
import { writeAuditLog } from "@/lib/server/audit";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requirePermission("disclosure:edit");
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();

  const { id } = await params;
  const response = await generateDisclosureResponse(prisma, ctx.tenantId, id, ctx.user.id);
  await writeAuditLog({
    tenantId: ctx.tenantId,
    userId: ctx.user.id,
    action: "disclosure.response.generate",
    entityType: "DisclosureResponse",
    entityId: response.id,
    severity: "WARNING",
    metadata: { disclosureRequestId: id, comparisonGroup: response.comparisonGroup, comparisonEmployeeCount: response.comparisonEmployeeCount },
  });
  return ok({ responseId: response.id, status: "WAITING_FOR_LEGAL" });
}
