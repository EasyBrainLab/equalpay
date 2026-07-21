import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { RetentionPolicyForm, RoleAssignmentForm, UserCreateForm, UserManagementForm } from "@/components/forms/hr-admin-forms";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/session";
import { hasPermission } from "@/lib/security/permissions";
import { completionPercent, getActiveOnboardingModules, moduleAppliesToRoles } from "@/lib/domain/onboarding";

export default async function AdminPage() {
  const ctx = await requireAuth();
  const canAdminUsers = hasPermission(ctx.roles, "users:admin");
  const canAdminRetention = hasPermission(ctx.roles, "retention:admin");
  const [users, audits, retentionPolicies, onboardingModules, onboardingCompletions] = await Promise.all([
    prisma.user.findMany({ where: { tenantId: ctx.tenantId }, include: { roles: true }, orderBy: { email: "asc" } }),
    prisma.auditLog.findMany({ where: { tenantId: ctx.tenantId }, include: { user: true }, orderBy: { createdAt: "desc" }, take: 25 }),
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
      <PageHeader title="Administration" description="Technische Administration ohne fachlichen Klartextzugriff. Produktiv nur mit SSO/MFA und KMS-Freigabe." />
      <main className="grid gap-6 p-6 xl:grid-cols-2">
        {canAdminUsers && (
          <>
            <UserCreateForm />
            <UserManagementForm
              currentUserId={ctx.user.id}
              users={users.map((user) => ({
                id: user.id,
                label: user.name,
                email: user.email,
                authProvider: user.authProvider,
                azureObjectId: user.azureObjectId,
                status: user.status,
                roles: user.roles.map((role) => role.role),
              }))}
            />
            <RoleAssignmentForm users={users.map((user) => ({ id: user.id, label: user.name, email: user.email }))} />
          </>
        )}
        {!canAdminUsers && (
          <section className="rounded-md border border-ez-line bg-white p-4">
            <h2 className="font-semibold text-ez-navy">Benutzerverwaltung</h2>
            <p className="mt-2 text-sm leading-6 text-ez-muted">
              Benutzer duerfen nur mit der Berechtigung users:admin angelegt, bearbeitet, deaktiviert oder mit Rollen versehen werden.
            </p>
          </section>
        )}
        {canAdminRetention && <RetentionPolicyForm />}
        <section className="rounded-md border border-ez-line bg-white">
          <div className="border-b border-ez-line px-4 py-3">
            <h2 className="font-semibold">Benutzer und Rollen</h2>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-ez-bg text-xs uppercase text-ez-muted">
              <tr>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Provider</th>
                <th className="px-3 py-2">Rollen</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-ez-line">
                  <td className="px-3 py-2">
                    <div className="font-medium">{user.name}</div>
                    <div className="text-xs text-ez-muted">{user.email}</div>
                  </td>
                  <td className="px-3 py-2">{user.authProvider}</td>
                  <td className="px-3 py-2">{user.roles.map((role) => role.role).join(", ")}</td>
                  <td className="px-3 py-2"><Badge tone={user.status === "ACTIVE" ? "good" : "warn"}>{user.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rounded-md border border-ez-line bg-white xl:col-span-2">
          <div className="border-b border-ez-line px-4 py-3">
            <h2 className="font-semibold">Onboarding-Nachweise</h2>
            <p className="mt-1 text-sm text-ez-muted">Auditfaehige Sicht auf Schulungsstand je aktivem Benutzer und Modulversion.</p>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-ez-bg text-xs uppercase text-ez-muted">
              <tr>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Relevante Module</th>
                <th className="px-3 py-2">Abgeschlossen</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Letzter Nachweis</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const roles = user.roles.map((role) => role.role);
                const requiredModules = onboardingModules.filter((module) => moduleAppliesToRoles(module, roles));
                const completionKeys = completionKeysByUser.get(user.id) ?? new Set<string>();
                const completed = requiredModules.filter((module) => completionKeys.has(`${module.key}:${module.version}`)).length;
                const percent = completionPercent(completed, requiredModules.length);
                const latest = latestCompletionByUser.get(user.id);
                return (
                  <tr key={user.id} className="border-t border-ez-line">
                    <td className="px-3 py-2">
                      <div className="font-medium">{user.name}</div>
                      <div className="text-xs text-ez-muted">{user.email}</div>
                    </td>
                    <td className="px-3 py-2">{requiredModules.length}</td>
                    <td className="px-3 py-2">{completed}</td>
                    <td className="px-3 py-2"><Badge tone={percent === 100 ? "good" : percent === 0 ? "danger" : "warn"}>{percent}%</Badge></td>
                    <td className="px-3 py-2 text-ez-muted">{latest ? latest.toLocaleString("de-DE") : "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {canAdminRetention && (
          <section className="rounded-md border border-ez-line bg-white">
            <div className="border-b border-ez-line px-4 py-3">
              <h2 className="font-semibold">Retention Policies</h2>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-ez-bg text-xs uppercase text-ez-muted">
                <tr>
                  <th className="px-3 py-2">Objekt</th>
                  <th className="px-3 py-2">Tage</th>
                  <th className="px-3 py-2">Aktion</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {retentionPolicies.map((policy) => (
                  <tr key={policy.id} className="border-t border-ez-line">
                    <td className="px-3 py-2 font-medium">{policy.entityType}</td>
                    <td className="px-3 py-2">{policy.retentionDays}</td>
                    <td className="px-3 py-2">{policy.action}</td>
                    <td className="px-3 py-2"><Badge tone={policy.active ? "good" : "neutral"}>{policy.active ? "aktiv" : "inaktiv"}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section className="rounded-md border border-ez-line bg-white">
          <div className="border-b border-ez-line px-4 py-3">
            <h2 className="font-semibold">Audit Trail</h2>
          </div>
          <div className="divide-y divide-ez-line">
            {audits.map((audit) => (
              <div key={audit.id} className="px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">{audit.action}</div>
                  <Badge tone={audit.severity === "CRITICAL" ? "danger" : audit.severity === "WARNING" ? "warn" : "neutral"}>{audit.severity}</Badge>
                </div>
                <div className="mt-1 text-xs text-ez-muted">
                  {audit.createdAt.toLocaleString("de-DE")} · {audit.user?.email ?? "system"} · {audit.entityType ?? "-"}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
