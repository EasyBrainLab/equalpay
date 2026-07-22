import { describe, expect, it } from "vitest";
import { hasPermission } from "@/lib/security/permissions";
import type { Permission } from "@/lib/security/permissions";

describe("permissions", () => {
  it("allows HR admins and system admins to administer users", () => {
    expect(hasPermission(["HR_ADMIN"], "users:admin")).toBe(true);
    expect(hasPermission(["SYSTEM_ADMIN"], "users:admin")).toBe(true);
    expect(hasPermission(["HR_VIEWER"], "users:admin")).toBe(false);
  });

  // Variante A: HR_ADMIN ist die HR-Vollzugriffsrolle (voller CRUD über die
  // *:edit-Permissions). Diese müssen alle vorhanden sein, damit die neuen
  // Update/Delete-Endpunkte für HR_ADMIN nutzbar sind.
  const editPermissions: Permission[] = [
    "employees:edit",
    "pay:edit",
    "job:edit",
    "org:edit",
    "disclosure:edit",
    "documents:edit",
    "recruitment:edit",
  ];

  it("grants HR_ADMIN full edit access across HR domains", () => {
    for (const permission of editPermissions) {
      expect(hasPermission(["HR_ADMIN"], permission)).toBe(true);
    }
  });

  // Funktionstrennung (Segregation of Duties): SECURITY_ADMIN und SYSTEM_ADMIN
  // dürfen KEINE HR-/Vergütungsdaten bearbeiten. Dieser Test schlägt an, falls
  // die Kontrolle versehentlich aufgeweicht wird.
  it("keeps SECURITY_ADMIN and SYSTEM_ADMIN out of HR data editing", () => {
    for (const permission of [...editPermissions, "employees:view", "pay:view", "pay:decrypt"] as Permission[]) {
      expect(hasPermission(["SECURITY_ADMIN"], permission)).toBe(false);
      expect(hasPermission(["SYSTEM_ADMIN"], permission)).toBe(false);
    }
  });
});
