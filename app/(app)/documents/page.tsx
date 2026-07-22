import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { DocumentUploadForm, DocumentManageForm } from "@/components/forms/hr-admin-forms";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/session";
import { hasPermission } from "@/lib/security/permissions";

export default async function DocumentsPage() {
  const ctx = await requireAuth();
  const canEdit = hasPermission(ctx.roles, "documents:edit");
  const documents = await prisma.document.findMany({
    where: { tenantId: ctx.tenantId },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <>
      <PageHeader title="Dokumente" description="Policies, Betriebsvereinbarungen, Legal-Memos und Reporting-Artefakte mit Sensitivitaetsklassen." />
      <main className="space-y-6 p-6">
        {canEdit && (
          <div className="space-y-6">
            <DocumentUploadForm />
            <DocumentManageForm
              documents={documents.map((document) => ({
                id: document.id,
                title: document.title,
                type: document.type,
                sensitivity: document.sensitivity,
              }))}
            />
          </div>
        )}
        <div className="overflow-hidden rounded-md border border-ez-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-ez-bg text-xs uppercase text-ez-muted">
              <tr>
                <th className="px-3 py-2">Titel</th>
                <th className="px-3 py-2">Typ</th>
                <th className="px-3 py-2">Sensitivitaet</th>
                <th className="px-3 py-2">Version</th>
                <th className="px-3 py-2">Aktualisiert</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((document) => (
                <tr key={document.id} className="border-t border-ez-line">
                  <td className="px-3 py-2 font-medium">{document.title}</td>
                  <td className="px-3 py-2">{document.type}</td>
                  <td className="px-3 py-2"><Badge tone={document.sensitivity.includes("PAY") || document.sensitivity.includes("LEGAL") ? "danger" : "neutral"}>{document.sensitivity}</Badge></td>
                  <td className="px-3 py-2">{document.versions[0]?.version ?? "-"}</td>
                  <td className="px-3 py-2">{document.updatedAt.toLocaleDateString("de-DE")}</td>
                </tr>
              ))}
              {!documents.length && (
                <tr>
                  <td className="px-3 py-6 text-ez-muted" colSpan={5}>Noch keine Dokumente angelegt.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
