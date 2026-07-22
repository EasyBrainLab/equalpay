import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { CompensationForm, CompensationManageForm } from "@/components/forms/hr-admin-forms";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/session";
import { hasPermission } from "@/lib/security/permissions";
import { decryptField } from "@/lib/security/crypto";
import { formatMoney } from "@/lib/domain/money";
import { writeAuditLog } from "@/lib/server/audit";

export default async function CompensationPage() {
  const ctx = await requireAuth();
  const canViewPay = hasPermission(ctx.roles, "pay:view");
  const canEditPay = hasPermission(ctx.roles, "pay:edit");
  const canDecrypt = hasPermission(ctx.roles, "pay:decrypt");

  const [components, employees] = await Promise.all([
    canViewPay
      ? prisma.compensationComponent.findMany({
          where: { tenantId: ctx.tenantId },
          include: {
            employee: {
              include: { jobProfile: true, payGrade: true },
            },
          },
          orderBy: [{ employee: { displayName: "asc" } }, { validFrom: "desc" }],
          take: 500,
        })
      : [],
    prisma.employee.findMany({
      where: { tenantId: ctx.tenantId },
      include: { jobProfile: true, payGrade: true },
      orderBy: { displayName: "asc" },
    }),
  ]);

  if (canDecrypt && components.length) {
    await writeAuditLog({
      tenantId: ctx.tenantId,
      userId: ctx.user.id,
      action: "compensation.decrypt.page",
      entityType: "CompensationComponent",
      severity: "WARNING",
      metadata: { count: components.length },
    });
  }

  return (
    <>
      <PageHeader
        title="Verguetung"
        description="Verschluesselte Gehaltsbestandteile mit objektivem Grund, Geltungszeitraum und Freigabestatus."
      />
      <main className="space-y-6 p-6">
        {canEditPay && (
          <div className="space-y-6">
            <CompensationForm
              employees={employees.map((item) => ({
                id: item.id,
                label: `${item.displayName} (${item.employeeNumber})`,
                meta: `${item.payGrade?.code ?? "-"} · ${item.jobProfile?.title ?? "ohne Rolle"}`,
              }))}
            />
            {canViewPay && (
              <CompensationManageForm
                components={components.map((component) => ({
                  id: component.id,
                  label: `${component.employee.displayName} · ${component.type} · ${component.label}`,
                  type: component.type,
                  compLabel: component.label,
                  currency: component.currency,
                  validFrom: component.validFrom.toISOString().slice(0, 10),
                  validTo: component.validTo ? component.validTo.toISOString().slice(0, 10) : null,
                  legalBasis: component.legalBasis ?? "",
                  objectiveReason: component.objectiveReason ?? "",
                }))}
              />
            )}
          </div>
        )}
        {!canViewPay && (
          <div className="rounded-md border border-ez-line bg-white p-6 text-sm text-ez-muted">
            Fuer diese Ansicht fehlt die Berechtigung fuer Verguetungsdaten.
          </div>
        )}
        {canViewPay && (
          <div className="overflow-hidden rounded-md border border-ez-line bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-ez-bg text-xs uppercase text-ez-muted">
                <tr>
                  <th className="px-3 py-2">Mitarbeiter</th>
                  <th className="px-3 py-2">Pseudonym</th>
                  <th className="px-3 py-2">Rolle</th>
                  <th className="px-3 py-2">Grade</th>
                  <th className="px-3 py-2">Art</th>
                  <th className="px-3 py-2">Betrag</th>
                  <th className="px-3 py-2">Gueltig ab</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Objektiver Grund</th>
                </tr>
              </thead>
              <tbody>
                {components.map((component) => {
                  const amountCents = canDecrypt
                    ? Number(
                        decryptField(
                          { ciphertext: component.amountCiphertext, keyId: component.amountKeyId, algorithm: "aes-256-gcm" },
                          `${ctx.tenantId}:${component.employeeId}:${component.type}`,
                        ),
                      )
                    : null;
                  return (
                    <tr key={component.id} className="border-t border-ez-line align-top">
                      <td className="px-3 py-2 font-medium">{component.employee.displayName}</td>
                      <td className="px-3 py-2">{component.employee.pseudonym}</td>
                      <td className="px-3 py-2">{component.employee.jobProfile?.title ?? "-"}</td>
                      <td className="px-3 py-2">{component.employee.payGrade?.code ?? "-"}</td>
                      <td className="px-3 py-2">{component.type}</td>
                      <td className="px-3 py-2 font-medium">
                        {amountCents === null ? `verschluesselt ...${component.amountLast4 ?? "----"}` : formatMoney(amountCents, component.currency)}
                      </td>
                      <td className="px-3 py-2">{component.validFrom.toLocaleDateString("de-DE")}</td>
                      <td className="px-3 py-2">
                        <Badge tone={component.approvalStatus === "APPROVED" ? "good" : "warn"}>{component.approvalStatus}</Badge>
                      </td>
                      <td className="max-w-xs px-3 py-2 text-ez-muted">{component.objectiveReason ?? "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
