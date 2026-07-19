import { createHash } from "node:crypto";
import type { OnboardingModule, RoleKey } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { DEFAULT_ONBOARDING_MODULES, type OnboardingModuleSeed } from "@/lib/domain/onboarding-content";

export function onboardingModuleHash(module: Pick<OnboardingModuleSeed, "key" | "version" | "title" | "objective" | "content">): string {
  return createHash("sha256")
    .update(`${module.key}:${module.version}:${module.title}:${module.objective}:${module.content}`)
    .digest("hex");
}

export async function ensureOnboardingModules(tenantId: string): Promise<OnboardingModule[]> {
  await Promise.all(
    DEFAULT_ONBOARDING_MODULES.map((module) =>
      prisma.onboardingModule.upsert({
        where: {
          tenantId_key_version: {
            tenantId,
            key: module.key,
            version: module.version,
          },
        },
        update: {
          title: module.title,
          objective: module.objective,
          content: module.content,
          contentHash: onboardingModuleHash(module),
          estimatedMinutes: module.estimatedMinutes,
          sortOrder: module.sortOrder,
          applicableRoles: module.applicableRoles,
          required: true,
          active: true,
        },
        create: {
          tenantId,
          key: module.key,
          version: module.version,
          title: module.title,
          objective: module.objective,
          content: module.content,
          contentHash: onboardingModuleHash(module),
          estimatedMinutes: module.estimatedMinutes,
          sortOrder: module.sortOrder,
          applicableRoles: module.applicableRoles,
          required: true,
          active: true,
        },
      }),
    ),
  );

  return prisma.onboardingModule.findMany({
    where: { tenantId, active: true },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
  });
}

export async function getActiveOnboardingModules(tenantId: string): Promise<OnboardingModule[]> {
  const modules = await prisma.onboardingModule.findMany({
    where: { tenantId, active: true },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
  });
  if (modules.length >= DEFAULT_ONBOARDING_MODULES.length) return modules;
  return ensureOnboardingModules(tenantId);
}

export function moduleAppliesToRoles(module: Pick<OnboardingModule, "applicableRoles">, roles: RoleKey[]): boolean {
  if (module.applicableRoles.length === 0) return true;
  return module.applicableRoles.some((role) => roles.includes(role));
}

export function completionPercent(completedCount: number, requiredCount: number): number {
  if (requiredCount === 0) return 100;
  return Math.round((completedCount / requiredCount) * 100);
}
