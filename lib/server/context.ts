import type { Permission } from "@/lib/security/permissions";
import { hasPermission } from "@/lib/security/permissions";
import { getAuthSession } from "@/lib/auth/session";

export async function getRequestContext() {
  return getAuthSession();
}

export async function requirePermission(permission: Permission) {
  const ctx = await getRequestContext();
  if (!ctx) return { ctx: null, error: "unauthorized" as const };
  if (!hasPermission(ctx.roles, permission)) return { ctx: null, error: "forbidden" as const };
  return { ctx, error: null };
}
