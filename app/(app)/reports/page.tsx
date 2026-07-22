import { FileText } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { RecordManager, type ColumnDef, type FieldDef, type FilterDef } from "@/components/data/record-manager";
import { ReportGenerateForm } from "@/components/forms/hr-admin-forms";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/session";
import { hasPermission } from "@/lib/security/permissions";

const reportStatuses = ["DRAFT", "GENERATED", "APPROVED", "SUBMITTED", "ARCHIVED"];

export default async function ReportsPage() {
  const ctx = await requireAuth();
  const canGenerate = hasPermission(ctx.roles, "reports:approve");
  const reports = await prisma.complianceReport.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { generatedAt: "desc" }, take: 100 });

  const rows = reports.map((report) => ({
    id: report.id,
    name: report.name,
    type: report.type,
    status: report.status,
    period: `${report.periodStart.toLocaleDateString("de-DE")} – ${report.periodEnd.toLocaleDateString("de-DE")}`,
    hasExport: Boolean(report.exportChecksumSha256),
  }));

  const columns: ColumnDef[] = [
    { key: "name", header: "Name" },
    { key: "type", header: "Typ" },
    { key: "status", header: "Status", kind: "badge", tone: { APPROVED: "good", SUBMITTED: "good", "*": "warn" } },
    { key: "period", header: "Periode" },
    { key: "export", header: "Export", kind: "link", hrefTemplate: "/api/reports/{id}/download", linkLabel: "CSV", showKey: "hasExport" },
  ];

  const filters: FilterDef[] = [{ field: "status", label: "Status", options: [{ value: "", label: "Alle Status" }, ...reportStatuses.map((value) => ({ value, label: value }))] }];

  const fields: FieldDef[] = [
    { name: "name", label: "Name" },
    { name: "status", label: "Status", kind: "select", options: reportStatuses.map((value) => ({ id: value, label: value })) },
  ];

  return (
    <>
      <PageHeader title="Reports" description="Art.-9-Reporting, interne Dry-Runs und exportierbare Compliance-Artefakte." />
      <main className="space-y-6 p-6">
        {canGenerate && <ReportGenerateForm />}
        <RecordManager
          title="Compliance-Reports"
          icon={<FileText size={18} />}
          endpoint="/api/reports"
          rows={rows}
          columns={columns}
          fields={fields}
          searchKeys={["name", "type"]}
          filters={filters}
          canEdit={canGenerate}
          canCreate={false}
          deleteConfirm="Report „{name}“ löschen? Eingereichte Reports bleiben erhalten."
        />
      </main>
    </>
  );
}
