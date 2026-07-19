-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('ARTICLE_9_PAY_GAP', 'INTERNAL_DRY_RUN', 'DISCLOSURE_RESPONSE', 'REMEDIATION_STATUS');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('DRAFT', 'GENERATED', 'APPROVED', 'SUBMITTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RemediationStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_FOR_APPROVAL', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RecruitmentStatus" AS ENUM ('DRAFT', 'APPROVED', 'PUBLISHED', 'CLOSED');

-- CreateEnum
CREATE TYPE "RetentionAction" AS ENUM ('REVIEW', 'ANONYMIZE', 'DELETE', 'LEGAL_HOLD');

-- CreateTable
CREATE TABLE "DisclosureResponse" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "disclosureRequestId" TEXT NOT NULL,
    "employeeId" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedById" TEXT,
    "employeePayAmountCipher" TEXT,
    "employeePayKeyId" TEXT,
    "comparisonGroup" TEXT,
    "comparisonEmployeeCount" INTEGER NOT NULL DEFAULT 0,
    "averagePayFemale" INTEGER,
    "averagePayMale" INTEGER,
    "medianPayFemale" INTEGER,
    "medianPayMale" INTEGER,
    "answerText" TEXT NOT NULL,
    "legalReviewRequired" BOOLEAN NOT NULL DEFAULT true,
    "approvedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisclosureResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceReport" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "ReportType" NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'GENERATED',
    "name" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedById" TEXT,
    "payGapAnalysisId" TEXT,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "exportFormat" TEXT NOT NULL DEFAULT 'CSV',
    "exportChecksumSha256" TEXT,
    "exportCipher" TEXT,
    "findingsJson" JSONB NOT NULL DEFAULT '{}',
    "approvedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemediationAction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "payGapRowId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rootCause" TEXT,
    "objectiveReason" TEXT,
    "ownerUserId" TEXT,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" "RemediationStatus" NOT NULL DEFAULT 'OPEN',
    "completedAt" TIMESTAMP(3),
    "evidenceDocumentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RemediationAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruitmentPosting" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "jobProfileId" TEXT,
    "title" TEXT NOT NULL,
    "location" TEXT,
    "status" "RecruitmentStatus" NOT NULL DEFAULT 'DRAFT',
    "salaryMinAmount" INTEGER NOT NULL,
    "salaryMaxAmount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "payTransparencyText" TEXT NOT NULL,
    "genderNeutralCheck" BOOLEAN NOT NULL DEFAULT false,
    "priorPayQuestionBan" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecruitmentPosting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetentionPolicy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "retentionDays" INTEGER NOT NULL,
    "action" "RetentionAction" NOT NULL DEFAULT 'REVIEW',
    "legalBasis" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetentionPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DisclosureResponse_tenantId_idx" ON "DisclosureResponse"("tenantId");

-- CreateIndex
CREATE INDEX "DisclosureResponse_disclosureRequestId_idx" ON "DisclosureResponse"("disclosureRequestId");

-- CreateIndex
CREATE INDEX "DisclosureResponse_employeeId_idx" ON "DisclosureResponse"("employeeId");

-- CreateIndex
CREATE INDEX "ComplianceReport_tenantId_idx" ON "ComplianceReport"("tenantId");

-- CreateIndex
CREATE INDEX "ComplianceReport_type_idx" ON "ComplianceReport"("type");

-- CreateIndex
CREATE INDEX "ComplianceReport_status_idx" ON "ComplianceReport"("status");

-- CreateIndex
CREATE INDEX "ComplianceReport_periodEnd_idx" ON "ComplianceReport"("periodEnd");

-- CreateIndex
CREATE INDEX "RemediationAction_tenantId_idx" ON "RemediationAction"("tenantId");

-- CreateIndex
CREATE INDEX "RemediationAction_status_idx" ON "RemediationAction"("status");

-- CreateIndex
CREATE INDEX "RemediationAction_dueAt_idx" ON "RemediationAction"("dueAt");

-- CreateIndex
CREATE INDEX "RemediationAction_payGapRowId_idx" ON "RemediationAction"("payGapRowId");

-- CreateIndex
CREATE INDEX "RecruitmentPosting_tenantId_idx" ON "RecruitmentPosting"("tenantId");

-- CreateIndex
CREATE INDEX "RecruitmentPosting_status_idx" ON "RecruitmentPosting"("status");

-- CreateIndex
CREATE INDEX "RecruitmentPosting_jobProfileId_idx" ON "RecruitmentPosting"("jobProfileId");

-- CreateIndex
CREATE INDEX "RetentionPolicy_tenantId_idx" ON "RetentionPolicy"("tenantId");

-- CreateIndex
CREATE INDEX "RetentionPolicy_active_idx" ON "RetentionPolicy"("active");

-- CreateIndex
CREATE UNIQUE INDEX "RetentionPolicy_tenantId_entityType_key" ON "RetentionPolicy"("tenantId", "entityType");

-- AddForeignKey
ALTER TABLE "DisclosureResponse" ADD CONSTRAINT "DisclosureResponse_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisclosureResponse" ADD CONSTRAINT "DisclosureResponse_disclosureRequestId_fkey" FOREIGN KEY ("disclosureRequestId") REFERENCES "DisclosureRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisclosureResponse" ADD CONSTRAINT "DisclosureResponse_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceReport" ADD CONSTRAINT "ComplianceReport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceReport" ADD CONSTRAINT "ComplianceReport_payGapAnalysisId_fkey" FOREIGN KEY ("payGapAnalysisId") REFERENCES "PayGapAnalysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemediationAction" ADD CONSTRAINT "RemediationAction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemediationAction" ADD CONSTRAINT "RemediationAction_payGapRowId_fkey" FOREIGN KEY ("payGapRowId") REFERENCES "PayGapAnalysisRow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentPosting" ADD CONSTRAINT "RecruitmentPosting_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentPosting" ADD CONSTRAINT "RecruitmentPosting_jobProfileId_fkey" FOREIGN KEY ("jobProfileId") REFERENCES "JobProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetentionPolicy" ADD CONSTRAINT "RetentionPolicy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
