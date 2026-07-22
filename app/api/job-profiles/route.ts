import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { calculateEvaluationPoints, gradeForPoints } from "@/lib/domain/evaluation";
import { badRequest, forbidden, ok, readJson, unauthorized } from "@/lib/server/api";
import { requirePermission } from "@/lib/server/context";
import { writeAuditLog } from "@/lib/server/audit";

const jobProfileSchema = z.object({
  title: z.string().min(1),
  code: z.string().min(1),
  jobFamilyId: z.string().optional(),
  comparisonGroupId: z.string().optional(),
  summary: z.string().optional(),
  responsibilities: z.string().optional(),
  requirements: z.string().optional(),
  scores: z.array(z.object({ criterionId: z.string(), score: z.number().int().min(1).max(5) })).optional(),
});

const jobProfileUpdateSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  code: z.string().min(1),
  jobFamilyId: z.string().nullable().optional(),
  comparisonGroupId: z.string().nullable().optional(),
  payGradeId: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  responsibilities: z.string().nullable().optional(),
  requirements: z.string().nullable().optional(),
  status: z.enum(["DRAFT", "IN_REVIEW", "APPROVED", "ARCHIVED"]),
});

const jobProfileDeleteSchema = z.object({ id: z.string().min(1) });

export async function GET() {
  const { ctx, error } = await requirePermission("job:view");
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();
  const jobProfiles = await prisma.jobProfile.findMany({
    where: { tenantId: ctx.tenantId },
    include: { jobFamily: true, payGrade: true, comparisonGroup: true, evaluations: { include: { scores: true } } },
    orderBy: [{ code: "asc" }, { version: "desc" }],
  });
  return ok({ jobProfiles });
}

export async function POST(request: Request) {
  const { ctx, error } = await requirePermission("job:edit");
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();
  const input = await readJson(request, jobProfileSchema);
  const criteria = await prisma.evaluationCriterion.findMany({ where: { tenantId: ctx.tenantId } });
  const points =
    input.scores && input.scores.length
      ? calculateEvaluationPoints(
          input.scores.map((score) => ({
            criterionKey: score.criterionId,
            score: score.score,
            weight: criteria.find((criterion) => criterion.id === score.criterionId)?.weight ?? 25,
          })),
        )
      : null;
  const grades = await prisma.payGrade.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { sortOrder: "asc" } });
  const grade = points !== null ? gradeForPoints(points, grades) : null;
  const jobProfile = await prisma.jobProfile.create({
    data: {
      tenantId: ctx.tenantId,
      title: input.title,
      code: input.code,
      jobFamilyId: input.jobFamilyId,
      comparisonGroupId: input.comparisonGroupId,
      summary: input.summary,
      responsibilities: input.responsibilities,
      requirements: input.requirements,
      totalPoints: points,
      payGradeId: grade?.id,
      status: points === null ? "DRAFT" : "IN_REVIEW",
      evaluations:
        points !== null && input.scores
          ? {
              create: {
                tenantId: ctx.tenantId,
                totalPoints: points,
                scores: {
                  create: input.scores.map((score) => {
                    const criterion = criteria.find((item) => item.id === score.criterionId);
                    return {
                      criterionId: score.criterionId,
                      score: score.score,
                      weighted: Math.round((score.score / 5) * (criterion?.weight ?? 25)),
                    };
                  }),
                },
              },
            }
          : undefined,
    },
    include: { payGrade: true },
  });
  await writeAuditLog({
    tenantId: ctx.tenantId,
    userId: ctx.user.id,
    action: "job-profile.create",
    entityType: "JobProfile",
    entityId: jobProfile.id,
    severity: "WARNING",
    metadata: { code: jobProfile.code, points, payGrade: jobProfile.payGrade?.code ?? null },
  });
  return ok({ jobProfile });
}

export async function PATCH(request: Request) {
  const { ctx, error } = await requirePermission("job:edit");
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();
  const input = await readJson(request, jobProfileUpdateSchema);
  const existing = await prisma.jobProfile.findFirst({ where: { id: input.id, tenantId: ctx.tenantId } });
  if (!existing) return badRequest("Stellenprofil nicht gefunden");
  const { id, ...data } = input;
  try {
    const jobProfile = await prisma.jobProfile.update({ where: { id }, data });
    await writeAuditLog({
      tenantId: ctx.tenantId,
      userId: ctx.user.id,
      action: "job-profile.update",
      entityType: "JobProfile",
      entityId: jobProfile.id,
      severity: "WARNING",
      metadata: { code: jobProfile.code, status: jobProfile.status },
    });
    return ok({ jobProfile });
  } catch (caught) {
    if (caught instanceof Prisma.PrismaClientKnownRequestError && caught.code === "P2002") {
      return badRequest("Code/Version ist bereits vergeben.");
    }
    throw caught;
  }
}

export async function DELETE(request: Request) {
  const { ctx, error } = await requirePermission("job:edit");
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();
  const { id } = await readJson(request, jobProfileDeleteSchema);
  const existing = await prisma.jobProfile.findFirst({
    where: { id, tenantId: ctx.tenantId },
    include: { _count: { select: { employees: true } } },
  });
  if (!existing) return badRequest("Stellenprofil nicht gefunden");
  if (existing._count.employees > 0) {
    return badRequest("Stellenprofil ist Mitarbeitenden zugeordnet und kann nicht gelöscht werden. Bitte zuerst die Zuordnung ändern.");
  }
  await prisma.jobProfile.delete({ where: { id } });
  await writeAuditLog({
    tenantId: ctx.tenantId,
    userId: ctx.user.id,
    action: "job-profile.delete",
    entityType: "JobProfile",
    entityId: id,
    severity: "CRITICAL",
    metadata: { code: existing.code },
  });
  return ok({ deleted: id });
}
