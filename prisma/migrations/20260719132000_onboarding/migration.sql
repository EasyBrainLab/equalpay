-- CreateEnum
CREATE TYPE "OnboardingCompletionStatus" AS ENUM ('COMPLETED');

-- CreateTable
CREATE TABLE "OnboardingModule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "estimatedMinutes" INTEGER NOT NULL DEFAULT 5,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "applicableRoles" "RoleKey"[] NOT NULL DEFAULT ARRAY[]::"RoleKey"[],
    "required" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnboardingModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingCompletion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "moduleVersion" INTEGER NOT NULL,
    "status" "OnboardingCompletionStatus" NOT NULL DEFAULT 'COMPLETED',
    "attestationText" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnboardingCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingModule_tenantId_key_version_key" ON "OnboardingModule"("tenantId", "key", "version");

-- CreateIndex
CREATE INDEX "OnboardingModule_tenantId_idx" ON "OnboardingModule"("tenantId");

-- CreateIndex
CREATE INDEX "OnboardingModule_tenantId_active_idx" ON "OnboardingModule"("tenantId", "active");

-- CreateIndex
CREATE INDEX "OnboardingModule_key_idx" ON "OnboardingModule"("key");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingCompletion_tenantId_userId_moduleKey_moduleVersion_key" ON "OnboardingCompletion"("tenantId", "userId", "moduleKey", "moduleVersion");

-- CreateIndex
CREATE INDEX "OnboardingCompletion_tenantId_idx" ON "OnboardingCompletion"("tenantId");

-- CreateIndex
CREATE INDEX "OnboardingCompletion_userId_idx" ON "OnboardingCompletion"("userId");

-- CreateIndex
CREATE INDEX "OnboardingCompletion_moduleId_idx" ON "OnboardingCompletion"("moduleId");

-- CreateIndex
CREATE INDEX "OnboardingCompletion_completedAt_idx" ON "OnboardingCompletion"("completedAt");

-- AddForeignKey
ALTER TABLE "OnboardingModule" ADD CONSTRAINT "OnboardingModule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingCompletion" ADD CONSTRAINT "OnboardingCompletion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingCompletion" ADD CONSTRAINT "OnboardingCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingCompletion" ADD CONSTRAINT "OnboardingCompletion_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "OnboardingModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
