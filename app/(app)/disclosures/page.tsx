import { ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { RecordManager, type ColumnDef, type FieldDef, type FilterDef } from "@/components/data/record-manager";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/session";
import { hasPermission } from "@/lib/security/permissions";

const disclosureStatuses = ["RECEIVED", "IN_REVIEW", "WAITING_FOR_LEGAL", "READY", "ANSWERED", "OVERDUE", "CANCELLED"];

export default async function DisclosuresPage() {
  const ctx = await requireAuth();
  const canEdit = hasPermission(ctx.roles, "disclosure:edit");
  const [requests, employees] = await Promise.all([
    prisma.disclosureRequest.findMany({ where: { tenantId: ctx.tenantId }, orderBy: [{ status: "asc" }, { dueAt: "asc" }] }),
    prisma.employee.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { displayName: "asc" } }),
  ]);

  const employeeOptions = employees.map((employee) => ({ id: employee.id, label: `${employee.displayName} (${employee.employeeNumber})` }));

  const rows = requests.map((request) => ({
    id: request.id,
    requesterLabel: request.requesterLabel,
    employeeId: request.employeeId,
    comparisonGroup: request.comparisonGroup ?? "-",
    notes: request.notes,
    status: request.status,
    dueAt: request.dueAt.toISOString().slice(0, 10),
  }));

  const columns: ColumnDef[] = [
    { key: "requesterLabel", header: "Anfragende Person" },
    { key: "dueAt", header: "Fällig" },
    { key: "comparisonGroup", header: "Vergleichsgruppe" },
    { key: "status", header: "Status", kind: "badge", tone: { ANSWERED: "good", OVERDUE: "danger", "*": "warn" } },
  ];

  const filters: FilterDef[] = [{ field: "status", label: "Status", options: [{ value: "", label: "Alle Status" }, ...disclosureStatuses.map((value) => ({ value, label: value }))] }];

  const fields: FieldDef[] = [
    { name: "requesterLabel", label: "Anfragende Person" },
    { name: "employeeId", label: "Mitarbeiter", kind: "select", options: employeeOptions, optional: true },
    { name: "comparisonGroup", label: "Vergleichsgruppe", optional: true },
    { name: "status", label: "Status", kind: "select", options: disclosureStatuses.map((value) => ({ id: value, label: value })) },
    { name: "dueAt", label: "Fällig bis", kind: "date" },
    { name: "notes", label: "Notiz", kind: "textarea", optional: true, colSpan: 2 },
  ];

  return (
    <>
      <PageHeader title="Auskunftsanfragen" description="Fristen, Vergleichsgruppen, Datenschutzprüfung und Antwortstatus." />
      <main className="p-6">
        <RecordManager
          title="Auskunftsanfragen"
          icon={<ClipboardList size={18} />}
          endpoint="/api/disclosure-requests"
          rows={rows}
          columns={columns}
          fields={fields}
          searchKeys={["requesterLabel", "comparisonGroup"]}
          filters={filters}
          canEdit={canEdit}
          newLabel="Anfrage"
          deleteConfirm="Auskunftsersuchen von „{requesterLabel}“ löschen?"
        />
      </main>
    </>
  );
}
