import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { ONBOARDING_ATTESTATION } from "@/lib/domain/onboarding-content";
import { moduleAppliesToRoles } from "@/lib/domain/onboarding";
import { badRequest, forbidden, ok, readJson, unauthorized } from "@/lib/server/api";
import { getRequestContext } from "@/lib/server/context";
import { writeAuditLog } from "@/lib/server/audit";

const completeSchema = z.object({
  moduleId: z.string().min(1),
  attest: z.literal(true),
});

export async function POST(request: Request) {
  const ctx = await getRequestContext();
  if (!ctx) return unauthorized();

  const input = await readJson(request, completeSchema).catch(() => null);
  if (!input) return badRequest("Ungueltige Onboarding-Bestaetigung.");

  const module = await prisma.onboardingModule.findFirst({
    where: { id: input.moduleId, tenantId: ctx.tenantId, active: true },
  });
  if (!module) return badRequest("Schulungsmodul wurde nicht gefunden oder ist nicht aktiv.");
  if (!moduleAppliesToRoles(module, ctx.roles)) {
    return forbidden("Dieses Schulungsmodul ist fuer Ihre Rolle nicht vorgesehen.");
  }

  const h = await headers();
  const completion = await prisma.onboardingCompletion.upsert({
    where: {
      tenantId_userId_moduleKey_moduleVersion: {
        tenantId: ctx.tenantId,
        userId: ctx.user.id,
        moduleKey: module.key,
        moduleVersion: module.version,
      },
    },
    update: {
      moduleId: module.id,
      status: "COMPLETED",
      attestationText: ONBOARDING_ATTESTATION,
      completedAt: new Date(),
      ipAddress: h.get("x-forwarded-for"),
      userAgent: h.get("user-agent"),
    },
    create: {
      tenantId: ctx.tenantId,
      userId: ctx.user.id,
      moduleId: module.id,
      moduleKey: module.key,
      moduleVersion: module.version,
      status: "COMPLETED",
      attestationText: ONBOARDING_ATTESTATION,
      ipAddress: h.get("x-forwarded-for"),
      userAgent: h.get("user-agent"),
    },
  });

  await writeAuditLog({
    tenantId: ctx.tenantId,
    userId: ctx.user.id,
    action: "onboarding.module.complete",
    entityType: "OnboardingCompletion",
    entityId: completion.id,
    severity: "WARNING",
    ipAddress: h.get("x-forwarded-for"),
    userAgent: h.get("user-agent"),
    metadata: {
      moduleId: module.id,
      moduleKey: module.key,
      moduleVersion: module.version,
      contentHash: module.contentHash,
      attestationText: ONBOARDING_ATTESTATION,
    },
  });

  return ok({ completionId: completion.id });
}
