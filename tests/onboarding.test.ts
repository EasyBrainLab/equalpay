import { describe, expect, it } from "vitest";
import { DEFAULT_ONBOARDING_MODULES } from "@/lib/domain/onboarding-content";
import { completionPercent, moduleAppliesToRoles, onboardingModuleHash } from "@/lib/domain/onboarding";

describe("onboarding", () => {
  it("creates stable content hashes per module version", () => {
    const module = DEFAULT_ONBOARDING_MODULES[0];
    expect(onboardingModuleHash(module)).toHaveLength(64);
    expect(onboardingModuleHash(module)).toBe(onboardingModuleHash({ ...module }));
  });

  it("filters modules by applicable role", () => {
    expect(moduleAppliesToRoles({ applicableRoles: [] }, ["AUDITOR"])).toBe(true);
    expect(moduleAppliesToRoles({ applicableRoles: ["HR_ADMIN"] }, ["AUDITOR"])).toBe(false);
    expect(moduleAppliesToRoles({ applicableRoles: ["HR_ADMIN"] }, ["HR_ADMIN"])).toBe(true);
  });

  it("calculates audit-friendly progress percentages", () => {
    expect(completionPercent(0, 0)).toBe(100);
    expect(completionPercent(2, 7)).toBe(29);
    expect(completionPercent(7, 7)).toBe(100);
  });
});
