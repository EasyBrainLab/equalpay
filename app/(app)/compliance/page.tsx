import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/session";
import { collectComplianceFindings } from "@/lib/domain/compliance";
import { AlertTriangle, CheckCircle2, ClipboardCheck } from "lucide-react";

function tone(status: string) {
  if (status === "CRITICAL") return "danger" as const;
  if (status === "WARN") return "warn" as const;
  return "good" as const;
}

export default async function CompliancePage() {
  const ctx = await requireAuth();
  const findings = await collectComplianceFindings(prisma, ctx.tenantId);
  const critical = findings.filter((finding) => finding.status === "CRITICAL").length;
  const warnings = findings.filter((finding) => finding.status === "WARN").length;
  const ok = findings.filter((finding) => finding.status === "OK").length;

  return (
    <>
      <PageHeader title="Compliance" description="Pflichtkontrollen fuer Entgelttransparenz, Datenqualitaet, Fristen, Recruiting und Aufbewahrung." />
      <main className="space-y-6 p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label="Kritisch" value={critical} detail="sofort klaeren" icon={AlertTriangle} />
          <StatCard label="Warnungen" value={warnings} detail="fachlich nacharbeiten" icon={ClipboardCheck} />
          <StatCard label="OK" value={ok} detail="Kontrollen unauffaellig" icon={CheckCircle2} />
        </div>
        <section className="overflow-hidden rounded-md border border-ez-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-ez-bg text-xs uppercase text-ez-muted">
              <tr>
                <th className="px-3 py-2">Kontrolle</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Anzahl</th>
                <th className="px-3 py-2">Bewertung</th>
              </tr>
            </thead>
            <tbody>
              {findings.map((finding) => (
                <tr key={finding.key} className="border-t border-ez-line">
                  <td className="px-3 py-2 font-medium">{finding.label}</td>
                  <td className="px-3 py-2"><Badge tone={tone(finding.status)}>{finding.status}</Badge></td>
                  <td className="px-3 py-2">{finding.count}</td>
                  <td className="px-3 py-2 text-ez-muted">{finding.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </>
  );
}
