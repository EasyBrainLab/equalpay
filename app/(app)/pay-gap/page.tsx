import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { RunPayGapButton } from "@/components/ui/run-pay-gap-button";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/session";

export default async function PayGapPage() {
  const ctx = await requireAuth();
  const analyses = await prisma.payGapAnalysis.findMany({
    where: { tenantId: ctx.tenantId },
    include: { rows: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return (
    <>
      <PageHeader
        title="Pay-Gap-Analyse"
        description="Dry-Runs entschluesseln Gehaltsdaten nur im Backend, speichern aber nur aggregierte Ergebniszeilen."
        action={<RunPayGapButton />}
      />
      <main className="space-y-5 p-6">
        {analyses.map((analysis) => (
          <section key={analysis.id} className="overflow-hidden rounded-md border border-ez-line bg-white">
            <div className="flex items-center justify-between border-b border-ez-line px-4 py-3">
              <div>
                <h2 className="font-semibold text-ez-navy">{analysis.name}</h2>
                <p className="text-sm text-ez-muted">Datenstand {analysis.dataCutDate.toLocaleDateString("de-DE")} · erstellt {analysis.createdAt.toLocaleString("de-DE")}</p>
              </div>
              <Badge tone={analysis.rows.some((row) => row.triggerFivePercent) ? "danger" : "good"}>
                {analysis.rows.filter((row) => row.triggerFivePercent).length} Trigger
              </Badge>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-ez-bg text-xs uppercase text-ez-muted">
                <tr>
                  <th className="px-3 py-2">Vergleichsgruppe</th>
                  <th className="px-3 py-2">N</th>
                  <th className="px-3 py-2">Frauen</th>
                  <th className="px-3 py-2">Maenner</th>
                  <th className="px-3 py-2">Durchschnitt</th>
                  <th className="px-3 py-2">Median</th>
                  <th className="px-3 py-2">Bewertung</th>
                </tr>
              </thead>
              <tbody>
                {analysis.rows.map((row) => (
                  <tr key={row.id} className="border-t border-ez-line">
                    <td className="px-3 py-2 font-medium">{row.groupLabel}</td>
                    <td className="px-3 py-2">{row.employeeCount}</td>
                    <td className="px-3 py-2">{row.femaleCount}</td>
                    <td className="px-3 py-2">{row.maleCount}</td>
                    <td className="px-3 py-2">{Number(row.averageGapPercent).toFixed(2)}%</td>
                    <td className="px-3 py-2">{Number(row.medianGapPercent).toFixed(2)}%</td>
                    <td className="px-3 py-2">
                      <Badge tone={row.triggerFivePercent ? "danger" : "good"}>{row.triggerFivePercent ? "Abhilfe pruefen" : "OK"}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
        {!analyses.length && <div className="rounded-md border border-dashed border-ez-line bg-white p-8 text-sm text-ez-muted">Noch keine Pay-Gap-Analyse vorhanden.</div>}
      </main>
    </>
  );
}
