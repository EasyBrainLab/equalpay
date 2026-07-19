import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { forbidden, ok, readJson, unauthorized } from "@/lib/server/api";
import { requirePermission } from "@/lib/server/context";

const disclosureSchema = z.object({
  requesterLabel: z.string().min(1),
  employeeId: z.string().optional(),
  comparisonGroup: z.string().optional(),
  notes: z.string().optional(),
});

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
