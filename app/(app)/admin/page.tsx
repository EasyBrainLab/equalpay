import { AdminWorkspace } from "@/components/admin/admin-workspace";
import { PageHeader } from "@/components/layout/page-header";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/session";
import { completionPercent, getActiveOnboardingModules, moduleAppliesToRoles } from "@/lib/domain/onboarding";
import { hasPermission } from "@/lib/security/permissions";

export default async function AdminPage() {
  const ctx = await requireAuth();
  const canAdminUsers = hasPermission(ctx.roles, "users:admin");
  const canAdminRetention = hasPermission(ctx.roles, "retention:admin");
  const [users, audits, retentionPolicies, onboardingModules, onboardingCompletions] = await Promise.all([
    prisma.user.findMany({ where: { tenantId: ctx.tenantId }, include: { roles: true }, orderBy: { email: "asc" } }),
    prisma.auditLog.findMany({ where: { tenantId: ctx.tenantId }, include: { user: true }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.retentionPolicy.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { entityType: "asc" } }),
    getActiveOnboardingModules(ctx.tenantId),
    prisma.onboardingCompletion.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { completedAt: "desc" } }),
  ]);

  const completionKeysByUser = new Map<string, Set<string>>();
  const latestCompletionByUser = new Map<string, Date>();
  for (const completion of onboardingCompletions) {
    const keys = completionKeysByUser.get(completion.userId) ?? new Set<string>();
    keys.add(`${completion.moduleKey}:${completion.moduleVersion}`);
    completionKeysByUser.set(completion.userId, keys);
    const current = latestCompletionByUser.get(completion.userId);
    if (!current || completion.completedAt > current) latestCompletionByUser.set(completion.userId, completion.completedAt);
  }

  return (
    <>
      <PageHeader
        title="Administration"
        description="Zentrale Arbeitskonsole fuer Benutzer, Rollen, Onboarding, Retention und Audit-Nachweise."
      />
      <AdminWorkspace
        currentUserId={ctx.user.id}
        canAdminUsers={canAdminUsers}
        canAdminRetention={canAdminRetention}
        users={users.map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          authProvider: user.authProvider,
          azureObjectId: user.azureObjectId,
          status: user.status,
          lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
          roles: user.roles.map((role) => role.role),
        }))}
        onboardingRows={users.map((user) => {
          const roles = user.roles.map((role) => role.role);
          const requiredModules = onboardingModules.filter((module) => moduleAppliesToRoles(module, roles));
          const completionKeys = completionKeysByUser.get(user.id) ?? new Set<string>();
          const completedModules = requiredModules.filter((module) => completionKeys.has(`${module.key}:${module.version}`)).length;
          return {
            userId: user.id,
            name: user.name,
            email: user.email,
            roles,
            requiredModules: requiredModules.length,
            completedModules,
            percent: completionPercent(completedModules, requiredModules.length),
            latestCompletion: latestCompletionByUser.get(user.id)?.toISOString() ?? null,
          };
        })}
        retentionPolicies={retentionPolicies.map((policy) => ({
          id: policy.id,
          entityType: policy.entityType,
          retentionDays: policy.retentionDays,
          action: policy.action,
          legalBasis: policy.legalBasis,
          active: policy.active,
        }))}
        audits={audits.map((audit) => ({
          id: audit.id,
          action: audit.action,
          severity: audit.severity,
          entityType: audit.entityType,
          userEmail: audit.user?.email ?? null,
          createdAt: audit.createdAt.toISOString(),
        }))}
      />
    </>
  );
}
