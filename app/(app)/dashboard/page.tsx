import { AlertTriangle, BarChart3, ClipboardList, FileCheck2, Scale, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/session";

export default async function DashboardPage() {
  const ctx = await requireAuth();
  const [employeeCount, profileCount, approvedProfiles, bands, disclosures, latestAnalysis, auditCritical] = await Promise.all([
    prisma.employee.count({ where: { tenantId: ctx.tenantId } }),
    prisma.jobProfile.count({ where: { tenantId: ctx.tenantId } }),
    prisma.jobProfile.count({ where: { tenantId: ctx.tenantId, status: "APPROVED" } }),
    prisma.salaryBand.count({ where: { tenantId: ctx.tenantId } }),
    prisma.disclosureRequest.count({ where: { tenantId: ctx.tenantId, status: { notIn: ["ANSWERED", "CANCELLED"] } } }),
    prisma.payGapAnalysis.findFirst({ where: { tenantId: ctx.tenantId }, include: { rows: true }, orderBy: { createdAt: "desc" } }),
    prisma.auditLog.count({ where: { tenantId: ctx.tenantId, severity: "CRITICAL" } }),
  ]);

  const triggerRows = latestAnalysis?.rows.filter((row) => row.triggerFivePercent).length ?? 0;

  return (
    <>
      <PageHeader title="Dashboard" description="Compliance-, Datenqualitaets- und Pay-Gap-Ueberblick fuer HR." />
      <main className="p-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={Users} label="Mitarbeitende" value={employeeCount} detail="aktive und importierte Datensaetze" />
          <StatCard icon={FileCheck2} label="Stellenprofile" value={`${approvedProfiles}/${profileCount}`} detail="freigegeben / gesamt" />
          <StatCard icon={Scale} label="Gehaltsbaender" value={bands} detail="aktive Bandstrukturen" />
          <StatCard icon={ClipboardList} label="Auskunft offen" value={disclosures} detail="Fristen aktiv" />
        </div>

        <section className="mt-6 grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-md border border-ez-line bg-white">
            <div className="flex items-center justify-between border-b border-ez-line px-4 py-3">
              <div>
                <h2 className="font-semibold text-ez-navy">Letzter Pay-Gap-Dry-Run</h2>
                <p className="text-sm text-ez-muted">Fruehwarnung fuer Vergleichsgruppen ab 5 Prozent.</p>
              </div>
              <BarChart3 className="text-ez-petrol" />
            </div>
            <div className="p-4">
              {latestAnalysis ? (
                <div className="overflow-hidden rounded border border-ez-line">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-ez-bg text-xs uppercase text-ez-muted">
                      <tr>
                        <th className="px-3 py-2">Gruppe</th>
                        <th className="px-3 py-2">N</th>
                        <th className="px-3 py-2">Avg Gap</th>
                        <th className="px-3 py-2">Median Gap</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {latestAnalysis.rows.map((row) => (
                        <tr key={row.id} className="border-t border-ez-line">
                          <td className="px-3 py-2 font-medium">{row.groupLabel}</td>
                          <td className="px-3 py-2">{row.employeeCount}</td>
                          <td className="px-3 py-2">{Number(row.averageGapPercent).toFixed(1)}%</td>
                          <td className="px-3 py-2">{Number(row.medianGapPercent).toFixed(1)}%</td>
                          <td className="px-3 py-2">
                            <Badge tone={row.triggerFivePercent ? "danger" : "good"}>
                              {row.triggerFivePercent ? "Pruefen" : "OK"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded border border-dashed border-ez-line p-6 text-sm text-ez-muted">Noch keine Analyse vorhanden.</div>
              )}
            </div>
          </div>

          <div className="rounded-md border border-ez-line bg-white p-4">
            <h2 className="font-semibold text-ez-navy">Security Status</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span>Feldverschluesselung</span>
                <Badge tone="good">aktiv</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Systemadmin-Datentrennung</span>
                <Badge tone="warn">technisch vorbereitet</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Pay-Gap Trigger</span>
                <Badge tone={triggerRows ? "danger" : "good"}>{triggerRows}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Kritische Audit-Events</span>
                <Badge tone={auditCritical ? "danger" : "good"}>{auditCritical}</Badge>
              </div>
            </div>
            <div className="mt-5 flex gap-2 rounded bg-ez-burgundy-50 p-3 text-sm text-ez-burgundy-700">
              <AlertTriangle size={18} className="shrink-0" />
              Produktivbetrieb erfordert SSO/MFA, KMS/HSM und DSFA-Freigabe.
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
