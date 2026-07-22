import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { RemediationForm, RemediationManageForm } from "@/components/forms/hr-admin-forms";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/session";
import { hasPermission } from "@/lib/security/permissions";

function tone(status: string) {
  if (status === "COMPLETED") return "good" as const;
  if (status === "CANCELLED") return "neutral" as const;
  return "warn" as const;
}

export default async function RemediationPage() {
  const ctx = await requireAuth();
  const canEdit = hasPermission(ctx.roles, "reports:approve");
  const [actions, rows, users] = await Promise.all([
    prisma.remediationAction.findMany({ where: { tenantId: ctx.tenantId }, include: { payGapRow: true }, orderBy: [{ status: "asc" }, { dueAt: "asc" }] }),
    prisma.payGapAnalysisRow.findMany({
      where: { analysis: { tenantId: ctx.tenantId }, triggerFivePercent: true },
      include: { analysis: true },
      orderBy: { id: "desc" },
      take: 100,
    }),
    prisma.user.findMany({ where: { tenantId: ctx.tenantId, status: "ACTIVE" }, orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <PageHeader title="Massnahmen" description="Abhilfe, Ursachenanalyse und Nachverfolgung fuer ungeklärte Pay-Gap-Trigger." />
      <main className="space-y-6 p-6">
        {canEdit && (
          <div className="space-y-6">
            <RemediationForm
              payGapRows={rows.map((row) => ({ id: row.id, label: `${row.groupLabel} · ${Number(row.averageGapPercent).toFixed(2)}%` }))}
              users={users.map((user) => ({ id: user.id, label: user.name, email: user.email }))}
            />
            <RemediationManageForm
              actions={actions.map((action) => ({
                id: action.id,
                payGapRowId: action.payGapRowId,
                title: action.title,
                description: action.description,
                rootCause: action.rootCause,
                objectiveReason: action.objectiveReason,
                ownerUserId: action.ownerUserId,
                dueAt: action.dueAt.toISOString().slice(0, 10),
                status: action.status,
              }))}
              payGapRows={rows.map((row) => ({ id: row.id, label: `${row.groupLabel} · ${Number(row.averageGapPercent).toFixed(2)}%` }))}
              users={users.map((user) => ({ id: user.id, label: user.name, email: user.email }))}
            />
          </div>
        )}
        <section className="overflow-hidden rounded-md border border-ez-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-ez-bg text-xs uppercase text-ez-muted">
              <tr>
                <th className="px-3 py-2">Massnahme</th>
                <th className="px-3 py-2">Pay-Gap-Gruppe</th>
                <th className="px-3 py-2">Faellig</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Ursache / Grund</th>
              </tr>
            </thead>
            <tbody>
              {actions.map((action) => (
                <tr key={action.id} className="border-t border-ez-line align-top">
                  <td className="px-3 py-2"><div className="font-medium">{action.title}</div><div className="text-ez-muted">{action.description}</div></td>
                  <td className="px-3 py-2">{action.payGapRow?.groupLabel ?? "-"}</td>
                  <td className="px-3 py-2">{action.dueAt.toLocaleDateString("de-DE")}</td>
                  <td className="px-3 py-2"><Badge tone={tone(action.status)}>{action.status}</Badge></td>
                  <td className="px-3 py-2 text-ez-muted">{action.rootCause ?? action.objectiveReason ?? "-"}</td>
                </tr>
              ))}
              {!actions.length && (
                <tr><td className="px-3 py-6 text-ez-muted" colSpan={5}>Noch keine Massnahmen angelegt.</td></tr>
              )}
            </tbody>
          </table>
        </section>
      </main>
    </>
  );
}
