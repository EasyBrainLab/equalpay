import type { RoleKey } from "@prisma/client";

export type Permission =
  | "system:admin"
  | "security:admin"
  | "org:view"
  | "org:edit"
  | "employees:view"
  | "employees:edit"
  | "employees:sensitive:view"
  | "pay:view"
  | "pay:edit"
  | "pay:decrypt"
  | "job:view"
  | "job:edit"
  | "job:ai-assist"
  | "evaluation:approve"
  | "analytics:view"
  | "analytics:run"
  | "disclosure:view"
  | "disclosure:edit"
  | "documents:view"
  | "documents:edit"
  | "reports:view"
  | "reports:approve"
  | "recruitment:view"
  | "recruitment:edit"
  | "retention:admin"
  | "audit:view";

export const ROLE_PERMISSIONS: Record<RoleKey, Permission[]> = {
  SYSTEM_ADMIN: ["system:admin", "org:view", "audit:view"],
  SECURITY_ADMIN: ["security:admin", "retention:admin", "audit:view"],
  HR_ADMIN: [
    "org:view",
    "org:edit",
    "employees:view",
    "employees:edit",
    "employees:sensitive:view",
    "pay:view",
    "pay:edit",
    "pay:decrypt",
    "job:view",
    "job:edit",
    "job:ai-assist",
    "evaluation:approve",
    "analytics:view",
    "analytics:run",
    "disclosure:view",
    "disclosure:edit",
    "documents:view",
    "documents:edit",
    "reports:view",
    "reports:approve",
    "recruitment:view",
    "recruitment:edit",
    "audit:view",
  ],
  HR_ANALYST: ["org:view", "employees:view", "job:view", "analytics:view", "analytics:run", "reports:view", "recruitment:view"],
  COMPENSATION_MANAGER: [
    "org:view",
    "employees:view",
    "employees:sensitive:view",
    "pay:view",
    "pay:edit",
    "pay:decrypt",
    "job:view",
    "job:edit",
    "job:ai-assist",
    "analytics:view",
    "analytics:run",
    "reports:view",
    "recruitment:view",
    "recruitment:edit",
  ],
  HR_VIEWER: ["org:view", "employees:view", "job:view", "documents:view", "reports:view", "recruitment:view"],
  LEGAL_REVIEWER: ["org:view", "job:view", "analytics:view", "disclosure:view", "disclosure:edit", "documents:view", "reports:view", "reports:approve"],
  EMPLOYEE_REP_REVIEWER: ["org:view", "job:view", "analytics:view", "documents:view", "reports:view"],
  MANAGER_CONTRIBUTOR: ["org:view", "employees:view", "job:view", "documents:view"],
  AUDITOR: ["org:view", "analytics:view", "documents:view", "reports:view", "audit:view"],
  IMPORT_OPERATOR: ["org:view", "employees:view", "employees:edit", "pay:edit", "job:view", "documents:edit"],
};

export function hasPermission(roles: RoleKey[], permission: Permission): boolean {
  return roles.some((role) => ROLE_PERMISSIONS[role]?.includes(permission));
}

export function mayDecryptPay(roles: RoleKey[]): boolean {
  return hasPermission(roles, "pay:decrypt");
}
