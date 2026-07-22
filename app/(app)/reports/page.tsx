import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { ReportGenerateForm, ReportManageForm } from "@/components/forms/hr-admin-forms";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/session";
import { hasPermission } from "@/lib/security/permissions";

export default async function ReportsPage() {
  const ctx = await requireAuth();
  const canGenerate = hasPermission(ctx.roles, "reports:approve");
  const reports = await prisma.complianceReport.findMany({
    where: { tenantId: ctx.tenantId },
    orderBy: { generatedAt: "desc" },
    take: 100,
  });

  return (
    <>
      <PageHeader title="Reports" description="Art.-9-Reporting, interne Dry-Runs und exportierbare Compliance-Artefakte." />
      <main className="space-y-6 p-6">
        {canGenerate && (
          <div className="space-y-6">
            <ReportGenerateForm />
            <ReportManageForm reports={reports.map((report) => ({ id: report.id, name: report.name, status: report.status }))} />
          </div>
        )}
        <section className="overflow-hidden rounded-md border border-ez-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-ez-bg text-xs uppercase text-ez-muted">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Typ</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Periode</th>
                <th className="px-3 py-2">Checksumme</th>
                <th className="px-3 py-2">Export</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id} className="border-t border-ez-line">
                  <td className="px-3 py-2 font-medium">{report.name}</td>
                  <td className="px-3 py-2">{report.type}</td>
                  <td className="px-3 py-2"><Badge tone={report.status === "APPROVED" || report.status === "SUBMITTED" ? "good" : "warn"}>{report.status}</Badge></td>
                  <td className="px-3 py-2">{report.periodStart.toLocaleDateString("de-DE")} bis {report.periodEnd.toLocaleDateString("de-DE")}</td>
                  <td className="px-3 py-2 font-mono text-xs">{report.exportChecksumSha256?.slice(0, 16) ?? "-"}</td>
                  <td className="px-3 py-2">
                    <Link className="text-ez-petrol underline" href={`/api/reports/${report.id}/download`}>CSV</Link>
                  </td>
                </tr>
              ))}
              {!reports.length && (
                <tr><td className="px-3 py-6 text-ez-muted" colSpan={6}>Noch keine Reports erzeugt.</td></tr>
              )}
            </tbody>
          </table>
        </section>
      </main>
    </>
  );
}
