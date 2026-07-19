import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { forbidden, ok, readJson, unauthorized } from "@/lib/server/api";
import { requirePermission } from "@/lib/server/context";
import { writeAuditLog } from "@/lib/server/audit";

const transferSchema = z.object({
  reviewerNotes: z.string().optional(),
});

function codeFromName(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toUpperCase()
    .slice(0, 48);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requirePermission("job:edit");
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();

  const input = await readJson(request, transferSchema);
  const { id } = await params;
  const draft = await prisma.aiJobArchitectureDraft.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!draft) return forbidden("Entwurf nicht gefunden.");
  if (draft.transferredJobProfileId) return ok({ jobProfileId: draft.transferredJobProfileId, duplicate: true });

  const analysis = draft.analysisJson as {
    summary?: string;
    responsibilities?: string;
    requirements?: string;
    criteria?: Array<{ criterionId: string; score: number; weighted: number; evidence?: string }>;
  };
  const familyCode = codeFromName(draft.suggestedJobFamily ?? "AI Draft");
  const comparisonCode = codeFromName(draft.suggestedComparisonGroup ?? `${draft.suggestedCode} Vergleichsgruppe`);
  const [family, comparisonGroup, payGrade, existingProfiles] = await Promise.all([
    prisma.jobFamily.upsert({
      where: { tenantId_code: { tenantId: ctx.tenantId, code: familyCode } },
      update: {},
      create: { tenantId: ctx.tenantId, code: familyCode, name: draft.suggestedJobFamily ?? "AI Draft" },
    }),
    prisma.comparisonGroup.upsert({
      where: { tenantId_code: { tenantId: ctx.tenantId, code: comparisonCode } },
      update: {},
      create: {
        tenantId: ctx.tenantId,
        code: comparisonCode,
        name: draft.suggestedComparisonGroup ?? `${draft.suggestedTitle} Vergleichsgruppe`,
        description: "Aus KI-Entwurf uebernommen; fachlich zu pruefen und fortzuschreiben.",
      },
    }),
    draft.suggestedGradeCode
      ? prisma.payGrade.findFirst({ where: { tenantId: ctx.tenantId, code: draft.suggestedGradeCode } })
      : Promise.resolve(null),
    prisma.jobProfile.findMany({
      where: { tenantId: ctx.tenantId, code: draft.suggestedCode ?? "AI-DRAFT" },
      select: { version: true },
      orderBy: { version: "desc" },
    }),
  ]);

  const nextVersion = (existingProfiles[0]?.version ?? 0) + 1;
  const jobProfile = await prisma.jobProfile.create({
    data: {
      tenantId: ctx.tenantId,
      jobFamilyId: family.id,
      payGradeId: payGrade?.id,
      comparisonGroupId: comparisonGroup.id,
      title: draft.suggestedTitle ?? "AI Job Draft",
      code: draft.suggestedCode ?? "AI-DRAFT",
      version: nextVersion,
      status: "IN_REVIEW",
      summary: analysis.summary,
      responsibilities: analysis.responsibilities,
      requirements: analysis.requirements,
      totalPoints: draft.suggestedTotalPoints,
      evaluations:
        draft.suggestedTotalPoints && analysis.criteria?.length
          ? {
              create: {
                tenantId: ctx.tenantId,
                totalPoints: draft.suggestedTotalPoints,
                notes: "Aus AI Job Architecture Assistant uebernommen; Human Review erforderlich.",
                scores: {
                  create: analysis.criteria.map((criterion) => ({
                    criterionId: criterion.criterionId,
                    score: criterion.score,
                    weighted: criterion.weighted,
                    evidence: criterion.evidence,
                  })),
                },
              },
            }
          : undefined,
    },
  });

  await prisma.aiJobArchitectureDraft.update({
    where: { id: draft.id },
    data: {
      status: "TRANSFERRED",
      reviewerNotes: input.reviewerNotes,
      reviewedById: ctx.user.id,
      reviewedAt: new Date(),
      transferredJobProfileId: jobProfile.id,
    },
  });

  await writeAuditLog({
    tenantId: ctx.tenantId,
    userId: ctx.user.id,
    action: "ai-job-draft.transfer",
    entityType: "JobProfile",
    entityId: jobProfile.id,
    severity: "CRITICAL",
    metadata: { draftId: draft.id, code: jobProfile.code, version: jobProfile.version, status: "IN_REVIEW" },
  });

  return ok({ jobProfileId: jobProfile.id, duplicate: false });
}
