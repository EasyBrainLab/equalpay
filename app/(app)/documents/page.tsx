import { FileText } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { RecordManager, type ColumnDef, type FieldDef, type FilterDef } from "@/components/data/record-manager";
import { DocumentUploadForm } from "@/components/forms/hr-admin-forms";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/session";
import { hasPermission } from "@/lib/security/permissions";

const documentTypes = ["POLICY", "WORKS_AGREEMENT", "JOB_PROFILE", "LEGAL_MEMO", "REPORT", "OFFER", "TEMPLATE", "OTHER"];
const sensitivities = ["PUBLIC_CONFIG", "HR_STRUCTURAL", "PERSONAL_BASIC", "PERSONAL_SENSITIVE", "PAY_SENSITIVE", "PAY_ANALYTICS", "LEGAL_CONFIDENTIAL", "SECURITY"];

export default async function DocumentsPage() {
  const ctx = await requireAuth();
  const canEdit = hasPermission(ctx.roles, "documents:edit");
  const documents = await prisma.document.findMany({ where: { tenantId: ctx.tenantId }, include: { versions: { orderBy: { version: "desc" }, take: 1 } }, orderBy: { updatedAt: "desc" } });

  const rows = documents.map((document) => ({
    id: document.id,
    title: document.title,
    type: document.type,
    sensitivity: document.sensitivity,
    version: document.versions[0] ? String(document.versions[0].version) : "-",
    updatedAt: document.updatedAt.toLocaleDateString("de-DE"),
  }));

  const columns: ColumnDef[] = [
    { key: "title", header: "Titel" },
    { key: "type", header: "Typ" },
    { key: "sensitivity", header: "Sensitivität", kind: "badge", tone: { PERSONAL_SENSITIVE: "danger", PAY_SENSITIVE: "danger", PAY_ANALYTICS: "danger", LEGAL_CONFIDENTIAL: "danger", SECURITY: "danger", "*": "neutral" } },
    { key: "version", header: "Version" },
    { key: "updatedAt", header: "Aktualisiert" },
  ];

  const filters: FilterDef[] = [{ field: "type", label: "Typ", options: [{ value: "", label: "Alle Typen" }, ...documentTypes.map((value) => ({ value, label: value }))] }];

  const fields: FieldDef[] = [
    { name: "title", label: "Titel" },
    { name: "type", label: "Typ", kind: "select", options: documentTypes.map((value) => ({ id: value, label: value })) },
    { name: "sensitivity", label: "Sensitivität", kind: "select", options: sensitivities.map((value) => ({ id: value, label: value })) },
  ];

  return (
    <>
      <PageHeader title="Dokumente" description="Policies, Betriebsvereinbarungen, Legal-Memos und Reporting-Artefakte mit Sensitivitätsklassen." />
      <main className="space-y-6 p-6">
        {canEdit && <DocumentUploadForm />}
        <RecordManager
          title="Dokumente"
          icon={<FileText size={18} />}
          endpoint="/api/documents"
          rows={rows}
          columns={columns}
          fields={fields}
          searchKeys={["title", "type"]}
          filters={filters}
          canEdit={canEdit}
          canCreate={false}
          deleteConfirm="Dokument „{title}“ löschen?"
        />
      </main>
    </>
  );
}
