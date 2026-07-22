import { PageHeader } from "@/components/layout/page-header";
import { SalaryBandForm, SalaryBandManageForm } from "@/components/forms/hr-admin-forms";
import { prisma } from "@/lib/db/prisma";
import { formatMoney } from "@/lib/domain/money";
import { requireAuth } from "@/lib/auth/session";
import { hasPermission } from "@/lib/security/permissions";

export default async function PayBandsPage() {
  const ctx = await requireAuth();
  const canEdit = hasPermission(ctx.roles, "pay:edit");
  const [bands, payGrades] = await Promise.all([
    prisma.salaryBand.findMany({
      where: { tenantId: ctx.tenantId },
      include: { payGrade: true },
      orderBy: [{ payGrade: { sortOrder: "asc" } }, { validFrom: "desc" }],
    }),
    prisma.payGrade.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <>
      <PageHeader title="Gehaltsbaender" description="Min/Mid/Max je Grade. Individuelle Gehaelter bleiben verschluesselt und werden hier nicht angezeigt." />
      <main className="space-y-6 p-6">
        {canEdit && (
          <div className="space-y-6">
            <SalaryBandForm payGrades={payGrades.map((item) => ({ id: item.id, label: `${item.code} · ${item.name}` }))} />
            <SalaryBandManageForm
              bands={bands.map((band) => ({
                id: band.id,
                payGradeId: band.payGradeId,
                name: band.name,
                currency: band.currency,
                fullTimeHours: Number(band.fullTimeHours),
                minAmount: band.minAmount,
                midAmount: band.midAmount,
                maxAmount: band.maxAmount,
                validFrom: band.validFrom.toISOString().slice(0, 10),
                validTo: band.validTo ? band.validTo.toISOString().slice(0, 10) : null,
              }))}
              payGrades={payGrades.map((item) => ({ id: item.id, label: `${item.code} · ${item.name}` }))}
            />
          </div>
        )}
        <div className="overflow-hidden rounded-md border border-ez-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-ez-bg text-xs uppercase text-ez-muted">
              <tr>
                <th className="px-3 py-2">Grade</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Vollzeit</th>
                <th className="px-3 py-2">Min</th>
                <th className="px-3 py-2">Mid</th>
                <th className="px-3 py-2">Max</th>
                <th className="px-3 py-2">Gueltig ab</th>
              </tr>
            </thead>
            <tbody>
              {bands.map((band) => (
                <tr key={band.id} className="border-t border-ez-line">
                  <td className="px-3 py-2 font-semibold">{band.payGrade.code}</td>
                  <td className="px-3 py-2">{band.name}</td>
                  <td className="px-3 py-2">{Number(band.fullTimeHours)} h</td>
                  <td className="px-3 py-2">{formatMoney(band.minAmount, band.currency)}</td>
                  <td className="px-3 py-2 font-medium">{formatMoney(band.midAmount, band.currency)}</td>
                  <td className="px-3 py-2">{formatMoney(band.maxAmount, band.currency)}</td>
                  <td className="px-3 py-2">{band.validFrom.toLocaleDateString("de-DE")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
