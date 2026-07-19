-- CreateEnum
CREATE TYPE "AiJobDraftStatus" AS ENUM ('UPLOADED', 'ANALYZED', 'NEEDS_REVIEW', 'APPROVED', 'REJECTED', 'TRANSFERRED');

-- CreateTable
CREATE TABLE "AiJobPromptVersion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "outputSchema" JSONB NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiJobPromptVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiJobArchitectureDraft" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "promptVersionId" TEXT NOT NULL,
    "sourceFileName" TEXT NOT NULL,
    "sourceMimeType" TEXT NOT NULL,
    "sourceSizeBytes" INTEGER NOT NULL,
    "sourceChecksumSha256" TEXT NOT NULL,
    "businessUnit" TEXT,
    "companyCode" TEXT,
    "sourceLanguage" TEXT,
    "extractedTextCipher" TEXT NOT NULL,
    "extractedTextKeyId" TEXT NOT NULL,
    "redactionSummary" JSONB NOT NULL DEFAULT '{}',
    "status" "AiJobDraftStatus" NOT NULL DEFAULT 'ANALYZED',
    "placeholderProvider" TEXT NOT NULL DEFAULT 'LOCAL_HEURISTIC',
    "placeholderModel" TEXT NOT NULL DEFAULT 'no-external-ai',
    "promptHashSha256" TEXT NOT NULL,
    "analysisJson" JSONB NOT NULL DEFAULT '{}',
    "suggestedTitle" TEXT,
    "suggestedCode" TEXT,
    "suggestedJobFamily" TEXT,
    "suggestedComparisonGroup" TEXT,
    "suggestedGradeCode" TEXT,
    "suggestedTotalPoints" INTEGER,
    "confidence" DECIMAL(5,3),
    "missingInformation" JSONB NOT NULL DEFAULT '[]',
    "biasWarnings" JSONB NOT NULL DEFAULT '[]',
    "reviewerNotes" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "transferredJobProfileId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiJobArchitectureDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiJobPromptVersion_tenantId_idx" ON "AiJobPromptVersion"("tenantId");

-- CreateIndex
CREATE INDEX "AiJobPromptVersion_active_idx" ON "AiJobPromptVersion"("active");

-- CreateIndex
CREATE UNIQUE INDEX "AiJobPromptVersion_tenantId_version_key" ON "AiJobPromptVersion"("tenantId", "version");

-- CreateIndex
CREATE INDEX "AiJobArchitectureDraft_tenantId_idx" ON "AiJobArchitectureDraft"("tenantId");

-- CreateIndex
CREATE INDEX "AiJobArchitectureDraft_status_idx" ON "AiJobArchitectureDraft"("status");

-- CreateIndex
CREATE INDEX "AiJobArchitectureDraft_createdAt_idx" ON "AiJobArchitectureDraft"("createdAt");

-- CreateIndex
CREATE INDEX "AiJobArchitectureDraft_transferredJobProfileId_idx" ON "AiJobArchitectureDraft"("transferredJobProfileId");

-- AddForeignKey
ALTER TABLE "AiJobPromptVersion" ADD CONSTRAINT "AiJobPromptVersion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiJobArchitectureDraft" ADD CONSTRAINT "AiJobArchitectureDraft_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiJobArchitectureDraft" ADD CONSTRAINT "AiJobArchitectureDraft_promptVersionId_fkey" FOREIGN KEY ("promptVersionId") REFERENCES "AiJobPromptVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiJobArchitectureDraft" ADD CONSTRAINT "AiJobArchitectureDraft_transferredJobProfileId_fkey" FOREIGN KEY ("transferredJobProfileId") REFERENCES "JobProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
