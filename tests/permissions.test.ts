import { describe, expect, it } from "vitest";
import { hasPermission } from "@/lib/security/permissions";

describe("permissions", () => {
  it("allows HR admins and system admins to administer users", () => {
    expect(hasPermission(["HR_ADMIN"], "users:admin")).toBe(true);
    expect(hasPermission(["SYSTEM_ADMIN"], "users:admin")).toBe(true);
    expect(hasPermission(["HR_VIEWER"], "users:admin")).toBe(false);
  });
});
