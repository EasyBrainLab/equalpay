import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { analyzeJobDescription, ensureDefaultAiJobPromptVersion, promptHash } from "@/lib/domain/ai-job-assistant";
import { extractTextFromFile } from "@/lib/domain/document-extraction";
import { encryptField } from "@/lib/security/crypto";
import { badRequest, forbidden, ok, unauthorized } from "@/lib/server/api";
import { requirePermission } from "@/lib/server/context";
import { writeAuditLog } from "@/lib/server/audit";

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export async function POST(request: Request) {
  const { ctx, error } = await requirePermission("job:ai-assist");
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return badRequest("Stellenbeschreibung fehlt.");
  if (file.size <= 0) return badRequest("Datei ist leer.");
  if (file.size > MAX_UPLOAD_BYTES) return badRequest("Datei ist groesser als 15 MB.");

  const businessUnit = String(form.get("businessUnit") ?? "").trim() || undefined;
  const companyCode = String(form.get("companyCode") ?? "").trim() || undefined;
  const buffer = Buffer.from(await file.arrayBuffer());
  const checksum = createHash("sha256").update(buffer).digest("hex");
  const extraction = await extractTextFromFile(file);
  if (!extraction.text) return badRequest("Aus der Datei konnte kein Text extrahiert werden.");

  const promptVersion = await ensureDefaultAiJobPromptVersion(prisma, ctx.tenantId, ctx.user.id);
  const [criteria, payGrades] = await Promise.all([
    prisma.evaluationCriterion.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { sortOrder: "asc" } }),
    prisma.payGrade.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { sortOrder: "asc" } }),
  ]);
  const analysis = analyzeJobDescription({
    text: extraction.text,
    sourceFileName: file.name,
    businessUnit,
    criteria,
    payGrades,
  });
  const encryptedText = encryptField(extraction.text, `${ctx.tenantId}:${checksum}:AI_JOB_DRAFT`);

  const draft = await prisma.aiJobArchitectureDraft.create({
    data: {
      tenantId: ctx.tenantId,
      promptVersionId: promptVersion.id,
      sourceFileName: file.name,
      sourceMimeType: file.type || "application/octet-stream",
      sourceSizeBytes: file.size,
      sourceChecksumSha256: checksum,
      businessUnit,
      companyCode,
      sourceLanguage: extraction.language,
      extractedTextCipher: encryptedText.ciphertext,
      extractedTextKeyId: encryptedText.keyId,
      redactionSummary: { ...extraction.redactionSummary, warnings: extraction.warnings } as Prisma.InputJsonValue,
      status: analysis.missingInformation.length ? "NEEDS_REVIEW" : "ANALYZED",
      placeholderProvider: analysis.model.provider,
      placeholderModel: `${analysis.model.name}:${analysis.model.version}`,
      promptHashSha256: promptHash(promptVersion.systemPrompt),
      analysisJson: analysis as unknown as Prisma.InputJsonValue,
      suggestedTitle: analysis.suggestedTitle,
      suggestedCode: analysis.suggestedCode,
      suggestedJobFamily: analysis.suggestedJobFamily,
      suggestedComparisonGroup: analysis.suggestedComparisonGroup,
      suggestedGradeCode: analysis.suggestedGradeCode,
      suggestedTotalPoints: analysis.suggestedTotalPoints,
      confidence: analysis.confidence,
      missingInformation: analysis.missingInformation as Prisma.InputJsonValue,
      biasWarnings: analysis.biasWarnings as Prisma.InputJsonValue,
      createdById: ctx.user.id,
    },
  });

  await writeAuditLog({
    tenantId: ctx.tenantId,
    userId: ctx.user.id,
    action: "ai-job-draft.upload",
    entityType: "AiJobArchitectureDraft",
    entityId: draft.id,
    severity: "WARNING",
    metadata: { fileName: file.name, checksum, status: draft.status, provider: draft.placeholderProvider },
  });

  return ok({ draftId: draft.id, status: draft.status });
}
