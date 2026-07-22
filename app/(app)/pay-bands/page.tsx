import { Landmark } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { RecordManager, type ColumnDef, type FieldDef } from "@/components/data/record-manager";
import { prisma } from "@/lib/db/prisma";
import { formatMoney } from "@/lib/domain/money";
import { requireAuth } from "@/lib/auth/session";
import { hasPermission } from "@/lib/security/permissions";

export default async function PayBandsPage() {
  const ctx = await requireAuth();
  const canEdit = hasPermission(ctx.roles, "pay:edit");
  const [bands, payGrades] = await Promise.all([
    prisma.salaryBand.findMany({ where: { tenantId: ctx.tenantId }, include: { payGrade: true }, orderBy: [{ payGrade: { sortOrder: "asc" } }, { validFrom: "desc" }] }),
    prisma.payGrade.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { sortOrder: "asc" } }),
  ]);

  const payGradeOptions = payGrades.map((item) => ({ id: item.id, label: `${item.code} · ${item.name}` }));

  const rows = bands.map((band) => ({
    id: band.id,
    payGradeId: band.payGradeId,
    payGradeCode: band.payGrade.code,
    name: band.name,
    currency: band.currency,
    fullTimeHours: Number(band.fullTimeHours),
    minAmount: band.minAmount,
    midAmount: band.midAmount,
    maxAmount: band.maxAmount,
    minDisplay: formatMoney(band.minAmount, band.currency),
    midDisplay: formatMoney(band.midAmount, band.currency),
    maxDisplay: formatMoney(band.maxAmount, band.currency),
    validFrom: band.validFrom.toISOString().slice(0, 10),
    validTo: band.validTo ? band.validTo.toISOString().slice(0, 10) : null,
  }));

  const columns: ColumnDef[] = [
    { key: "payGradeCode", header: "Grade" },
    { key: "name", header: "Name" },
    { key: "minDisplay", header: "Min" },
    { key: "midDisplay", header: "Mid" },
    { key: "maxDisplay", header: "Max" },
    { key: "validFrom", header: "Gültig ab" },
  ];

  const fields: FieldDef[] = [
    { name: "payGradeId", label: "Grade", kind: "select", options: payGradeOptions },
    { name: "name", label: "Name" },
    { name: "currency", label: "Währung" },
    { name: "fullTimeHours", label: "Vollzeitstunden", kind: "number" },
    { name: "minAmount", label: "Min", kind: "money" },
    { name: "midAmount", label: "Mid", kind: "money" },
    { name: "maxAmount", label: "Max", kind: "money" },
    { name: "validFrom", label: "Gültig ab", kind: "date" },
    { name: "validTo", label: "Gültig bis", kind: "date", optional: true },
  ];

  return (
    <>
      <PageHeader title="Gehaltsbänder" description="Min/Mid/Max je Grade. Individuelle Gehälter bleiben verschlüsselt und werden hier nicht angezeigt." />
      <main className="p-6">
        <RecordManager
          title="Gehaltsbänder"
          icon={<Landmark size={18} />}
          endpoint="/api/salary-bands"
          rows={rows}
          columns={columns}
          fields={fields}
          searchKeys={["payGradeCode", "name"]}
          canEdit={canEdit}
          newLabel="Gehaltsband"
          deleteConfirm="Gehaltsband „{name}“ löschen?"
        />
      </main>
    </>
  );
}
