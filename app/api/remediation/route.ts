import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { forbidden, ok, readJson, unauthorized } from "@/lib/server/api";
import { requirePermission } from "@/lib/server/context";
import { writeAuditLog } from "@/lib/server/audit";

const remediationSchema = z.object({
  payGapRowId: z.string().optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  rootCause: z.string().optional(),
  objectiveReason: z.string().optional(),
  ownerUserId: z.string().optional(),
  dueAt: z.coerce.date(),
});

export async function GET() {
  const { ctx, error } = await requirePermission("reports:view");
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();

  const actions = await prisma.remediationAction.findMany({
    where: { tenantId: ctx.tenantId },
    include: { payGapRow: true },
    orderBy: [{ status: "asc" }, { dueAt: "asc" }],
    take: 200,
  });
  return ok({ actions });
}

export async function POST(request: Request) {
  const { ctx, error } = await requirePermission("reports:approve");
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();

  const input = await readJson(request, remediationSchema);
  const action = await prisma.remediationAction.create({
    data: {
      tenantId: ctx.tenantId,
      payGapRowId: input.payGapRowId,
      title: input.title,
      description: input.description,
      rootCause: input.rootCause,
      objectiveReason: input.objectiveReason,
      ownerUserId: input.ownerUserId,
      dueAt: input.dueAt,
      status: "OPEN",
    },
  });
  await writeAuditLog({
    tenantId: ctx.tenantId,
    userId: ctx.user.id,
    action: "remediation.create",
    entityType: "RemediationAction",
    entityId: action.id,
    severity: "CRITICAL",
    metadata: { title: action.title, dueAt: action.dueAt.toISOString(), payGapRowId: action.payGapRowId },
  });
  return ok({ actionId: action.id });
}
