import { Banknote } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { RecordManager, type ColumnDef, type FieldDef } from "@/components/data/record-manager";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/session";
import { hasPermission } from "@/lib/security/permissions";
import { decryptField } from "@/lib/security/crypto";
import { formatMoney } from "@/lib/domain/money";
import { writeAuditLog } from "@/lib/server/audit";

const compensationTypes = ["BASE_SALARY", "VARIABLE_PAY", "BONUS", "ALLOWANCE", "BENEFIT", "COMPANY_CAR", "PENSION", "SPECIAL_PAYMENT", "ONE_TIME_PAYMENT"];

export default async function CompensationPage() {
  const ctx = await requireAuth();
  const canView = hasPermission(ctx.roles, "pay:view");
  const canEdit = hasPermission(ctx.roles, "pay:edit");
  const canDecrypt = hasPermission(ctx.roles, "pay:decrypt");

  const [components, employees] = await Promise.all([
    canView ? prisma.compensationComponent.findMany({ where: { tenantId: ctx.tenantId }, include: { employee: true }, orderBy: [{ employee: { displayName: "asc" } }, { validFrom: "desc" }], take: 500 }) : [],
    prisma.employee.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { displayName: "asc" } }),
  ]);

  if (canDecrypt && components.length) {
    await writeAuditLog({ tenantId: ctx.tenantId, userId: ctx.user.id, action: "compensation.decrypt.page", entityType: "CompensationComponent", severity: "WARNING", metadata: { count: components.length } });
  }

  const employeeOptions = employees.map((employee) => ({ id: employee.id, label: `${employee.displayName} (${employee.employeeNumber})` }));

  const rows = components.map((component) => {
    const amountCents = canDecrypt
      ? Number(decryptField({ ciphertext: component.amountCiphertext, keyId: component.amountKeyId, algorithm: "aes-256-gcm" }, `${ctx.tenantId}:${component.employeeId}:${component.type}`))
      : null;
    return {
      id: component.id,
      employeeId: component.employeeId,
      employeeName: component.employee.displayName,
      type: component.type,
      label: component.label,
      amountCents,
      amountDisplay: amountCents === null ? `verschlüsselt …${component.amountLast4 ?? "----"}` : formatMoney(amountCents, component.currency),
      currency: component.currency,
      validFrom: component.validFrom.toISOString().slice(0, 10),
      validTo: component.validTo ? component.validTo.toISOString().slice(0, 10) : null,
      legalBasis: component.legalBasis,
      objectiveReason: component.objectiveReason,
      approvalStatus: component.approvalStatus,
    };
  });

  const columns: ColumnDef[] = [
    { key: "employeeName", header: "Mitarbeiter" },
    { key: "type", header: "Art" },
    { key: "amountDisplay", header: "Betrag" },
    { key: "validFrom", header: "Gültig ab" },
    { key: "approvalStatus", header: "Status", kind: "badge", tone: { APPROVED: "good", "*": "warn" } },
  ];

  const fields: FieldDef[] = [
    { name: "employeeId", label: "Mitarbeiter", kind: "select", options: employeeOptions },
    { name: "type", label: "Art", kind: "select", options: compensationTypes.map((value) => ({ id: value, label: value })) },
    { name: "label", label: "Label" },
    { name: "amountCents", label: "Betrag", kind: "money", hint: "Wird verschlüsselt gespeichert. Bei Änderung erneut zur Freigabe gestellt." },
    { name: "currency", label: "Währung" },
    { name: "validFrom", label: "Gültig ab", kind: "date" },
    { name: "validTo", label: "Gültig bis", kind: "date", optional: true },
    { name: "legalBasis", label: "Rechts-/Regelbasis", optional: true },
    { name: "objectiveReason", label: "Objektiver Grund", kind: "textarea", optional: true, colSpan: 2 },
  ];

  return (
    <>
      <PageHeader title="Vergütung" description="Verschlüsselte Gehaltsbestandteile mit objektivem Grund, Geltungszeitraum und Freigabestatus." />
      <main className="p-6">
        {!canView ? (
          <div className="rounded-md border border-ez-line bg-white p-6 text-sm text-ez-muted">Für diese Ansicht fehlt die Berechtigung für Vergütungsdaten.</div>
        ) : (
          <RecordManager
            title="Vergütungsbestandteile"
            icon={<Banknote size={18} />}
            endpoint="/api/compensation"
            rows={rows}
            columns={columns}
            fields={fields}
            searchKeys={["employeeName", "type", "label"]}
            canEdit={canEdit}
            newLabel="Bestandteil"
            deleteConfirm="Vergütungsbestandteil „{employeeName} · {type}“ löschen?"
          />
        )}
      </main>
    </>
  );
}
