import { Timer } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { RecordManager, type ColumnDef, type FieldDef, type FilterDef } from "@/components/data/record-manager";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/session";
import { hasPermission } from "@/lib/security/permissions";

const remediationStatuses = ["OPEN", "IN_PROGRESS", "WAITING_FOR_APPROVAL", "COMPLETED", "CANCELLED"];

export default async function RemediationPage() {
  const ctx = await requireAuth();
  const canEdit = hasPermission(ctx.roles, "reports:approve");
  const [actions, gapRows, users] = await Promise.all([
    prisma.remediationAction.findMany({ where: { tenantId: ctx.tenantId }, include: { payGapRow: true }, orderBy: [{ status: "asc" }, { dueAt: "asc" }] }),
    prisma.payGapAnalysisRow.findMany({ where: { analysis: { tenantId: ctx.tenantId }, triggerFivePercent: true }, orderBy: { id: "desc" }, take: 100 }),
    prisma.user.findMany({ where: { tenantId: ctx.tenantId, status: "ACTIVE" }, orderBy: { name: "asc" } }),
  ]);

  const gapOptions = gapRows.map((row) => ({ id: row.id, label: `${row.groupLabel} · ${Number(row.averageGapPercent).toFixed(2)}%` }));
  const userOptions = users.map((user) => ({ id: user.id, label: `${user.name} · ${user.email}` }));

  const rows = actions.map((action) => ({
    id: action.id,
    title: action.title,
    description: action.description,
    payGapRowId: action.payGapRowId,
    payGapLabel: action.payGapRow?.groupLabel ?? "-",
    rootCause: action.rootCause,
    objectiveReason: action.objectiveReason,
    ownerUserId: action.ownerUserId,
    dueAt: action.dueAt.toISOString().slice(0, 10),
    status: action.status,
  }));

  const columns: ColumnDef[] = [
    { key: "title", header: "Maßnahme", kind: "subtitle", subtitleKey: "description" },
    { key: "payGapLabel", header: "Pay-Gap-Gruppe" },
    { key: "dueAt", header: "Fällig" },
    { key: "status", header: "Status", kind: "badge", tone: { COMPLETED: "good", CANCELLED: "neutral", "*": "warn" } },
  ];

  const filters: FilterDef[] = [{ field: "status", label: "Status", options: [{ value: "", label: "Alle Status" }, ...remediationStatuses.map((value) => ({ value, label: value }))] }];

  const fields: FieldDef[] = [
    { name: "payGapRowId", label: "Pay-Gap-Zeile", kind: "select", options: gapOptions, optional: true },
    { name: "ownerUserId", label: "Verantwortlich", kind: "select", options: userOptions, optional: true },
    { name: "title", label: "Titel" },
    { name: "dueAt", label: "Fällig bis", kind: "date" },
    { name: "status", label: "Status", kind: "select", options: remediationStatuses.map((value) => ({ id: value, label: value })) },
    { name: "description", label: "Beschreibung", kind: "textarea", colSpan: 2 },
    { name: "rootCause", label: "Ursache", kind: "textarea", optional: true, colSpan: 2 },
    { name: "objectiveReason", label: "Objektiver Grund", kind: "textarea", optional: true, colSpan: 2 },
  ];

  return (
    <>
      <PageHeader title="Maßnahmen" description="Abhilfe, Ursachenanalyse und Nachverfolgung für ungeklärte Pay-Gap-Trigger." />
      <main className="p-6">
        <RecordManager
          title="Abhilfemaßnahmen"
          icon={<Timer size={18} />}
          endpoint="/api/remediation"
          rows={rows}
          columns={columns}
          fields={fields}
          searchKeys={["title", "description", "payGapLabel"]}
          filters={filters}
          canEdit={canEdit}
          newLabel="Maßnahme"
          deleteConfirm="Maßnahme „{title}“ löschen?"
        />
      </main>
    </>
  );
}
