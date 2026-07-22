import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { badRequest, forbidden, ok, readJson, unauthorized } from "@/lib/server/api";
import { requirePermission } from "@/lib/server/context";
import { writeAuditLog } from "@/lib/server/audit";

const recruitmentSchema = z.object({
  jobProfileId: z.string().optional(),
  title: z.string().min(1),
  location: z.string().optional(),
  salaryMinAmount: z.number().int().positive(),
  salaryMaxAmount: z.number().int().positive(),
  currency: z.string().length(3).default("EUR"),
  payTransparencyText: z.string().min(1),
  genderNeutralCheck: z.boolean().default(false),
  priorPayQuestionBan: z.boolean().default(true),
});

const recruitmentUpdateSchema = z.object({
  id: z.string().min(1),
  jobProfileId: z.string().nullable().optional(),
  title: z.string().min(1),
  location: z.string().nullable().optional(),
  salaryMinAmount: z.number().int().positive(),
  salaryMaxAmount: z.number().int().positive(),
  currency: z.string().length(3),
  payTransparencyText: z.string().min(1),
  genderNeutralCheck: z.boolean(),
  priorPayQuestionBan: z.boolean(),
  status: z.enum(["DRAFT", "APPROVED", "PUBLISHED", "CLOSED"]),
});

const recruitmentDeleteSchema = z.object({ id: z.string().min(1) });

export async function GET() {
  const { ctx, error } = await requirePermission("recruitment:view");
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();

  const postings = await prisma.recruitmentPosting.findMany({
    where: { tenantId: ctx.tenantId },
    include: { jobProfile: true },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  return ok({ postings });
}

export async function POST(request: Request) {
  const { ctx, error } = await requirePermission("recruitment:edit");
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();

  const input = await readJson(request, recruitmentSchema);
  const posting = await prisma.recruitmentPosting.create({
    data: {
      tenantId: ctx.tenantId,
      jobProfileId: input.jobProfileId,
      title: input.title,
      location: input.location,
      salaryMinAmount: input.salaryMinAmount,
      salaryMaxAmount: input.salaryMaxAmount,
      currency: input.currency,
      payTransparencyText: input.payTransparencyText,
      genderNeutralCheck: input.genderNeutralCheck,
      priorPayQuestionBan: input.priorPayQuestionBan,
      status: input.genderNeutralCheck && input.priorPayQuestionBan ? "APPROVED" : "DRAFT",
    },
  });
  await writeAuditLog({
    tenantId: ctx.tenantId,
    userId: ctx.user.id,
    action: "recruitment.create",
    entityType: "RecruitmentPosting",
    entityId: posting.id,
    severity: posting.status === "APPROVED" ? "INFO" : "WARNING",
    metadata: { title: posting.title, status: posting.status },
  });
  return ok({ postingId: posting.id, status: posting.status });
}

export async function PATCH(request: Request) {
  const { ctx, error } = await requirePermission("recruitment:edit");
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();
  const input = await readJson(request, recruitmentUpdateSchema);
  const existing = await prisma.recruitmentPosting.findFirst({ where: { id: input.id, tenantId: ctx.tenantId } });
  if (!existing) return badRequest("Ausschreibung nicht gefunden");
  const { id, jobProfileId, location, publishedAt, ...rest } = { ...input, publishedAt: existing.publishedAt };
  const posting = await prisma.recruitmentPosting.update({
    where: { id },
    data: {
      ...rest,
      jobProfileId: jobProfileId ?? null,
      location: location ?? null,
      publishedAt: input.status === "PUBLISHED" ? (publishedAt ?? new Date()) : publishedAt,
      closedAt: input.status === "CLOSED" ? (existing.closedAt ?? new Date()) : existing.closedAt,
    },
  });
  await writeAuditLog({
    tenantId: ctx.tenantId,
    userId: ctx.user.id,
    action: "recruitment.update",
    entityType: "RecruitmentPosting",
    entityId: posting.id,
    severity: "WARNING",
    metadata: { title: posting.title, status: posting.status },
  });
  return ok({ postingId: posting.id, status: posting.status });
}

export async function DELETE(request: Request) {
  const { ctx, error } = await requirePermission("recruitment:edit");
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();
  const { id } = await readJson(request, recruitmentDeleteSchema);
  const existing = await prisma.recruitmentPosting.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!existing) return badRequest("Ausschreibung nicht gefunden");
  await prisma.recruitmentPosting.delete({ where: { id } });
  await writeAuditLog({
    tenantId: ctx.tenantId,
    userId: ctx.user.id,
    action: "recruitment.delete",
    entityType: "RecruitmentPosting",
    entityId: id,
    severity: "WARNING",
    metadata: { title: existing.title },
  });
  return ok({ deleted: id });
}
