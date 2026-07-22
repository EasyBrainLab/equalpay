import { BriefcaseBusiness } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { RecordManager, type ColumnDef, type FieldDef, type FilterDef } from "@/components/data/record-manager";
import { prisma } from "@/lib/db/prisma";
import { formatMoney } from "@/lib/domain/money";
import { requireAuth } from "@/lib/auth/session";
import { hasPermission } from "@/lib/security/permissions";

const recruitmentStatuses = ["DRAFT", "APPROVED", "PUBLISHED", "CLOSED"];

export default async function RecruitmentPage() {
  const ctx = await requireAuth();
  const canEdit = hasPermission(ctx.roles, "recruitment:edit");
  const [postings, jobProfiles] = await Promise.all([
    prisma.recruitmentPosting.findMany({ where: { tenantId: ctx.tenantId }, include: { jobProfile: true }, orderBy: { updatedAt: "desc" } }),
    prisma.jobProfile.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { title: "asc" } }),
  ]);

  const jobProfileOptions = jobProfiles.map((item) => ({ id: item.id, label: `${item.title} (${item.code})` }));

  const rows = postings.map((posting) => ({
    id: posting.id,
    title: posting.title,
    location: posting.location ?? "-",
    jobProfileId: posting.jobProfileId,
    jobProfileTitle: posting.jobProfile?.title ?? "-",
    salaryMinAmount: posting.salaryMinAmount,
    salaryMaxAmount: posting.salaryMaxAmount,
    spanneDisplay: `${formatMoney(posting.salaryMinAmount, posting.currency)} – ${formatMoney(posting.salaryMaxAmount, posting.currency)}`,
    currency: posting.currency,
    payTransparencyText: posting.payTransparencyText,
    genderNeutralCheck: posting.genderNeutralCheck,
    priorPayQuestionBan: posting.priorPayQuestionBan,
    status: posting.status,
  }));

  const columns: ColumnDef[] = [
    { key: "title", header: "Position", kind: "subtitle", subtitleKey: "location" },
    { key: "jobProfileTitle", header: "Stelle" },
    { key: "spanneDisplay", header: "Spanne" },
    { key: "status", header: "Status", kind: "badge", tone: { APPROVED: "good", PUBLISHED: "good", "*": "warn" } },
  ];

  const filters: FilterDef[] = [{ field: "status", label: "Status", options: [{ value: "", label: "Alle Status" }, ...recruitmentStatuses.map((value) => ({ value, label: value }))] }];

  const fields: FieldDef[] = [
    { name: "title", label: "Titel" },
    { name: "jobProfileId", label: "Stellenprofil", kind: "select", options: jobProfileOptions, optional: true },
    { name: "location", label: "Standort", optional: true },
    { name: "currency", label: "Währung" },
    { name: "salaryMinAmount", label: "Gehalt min", kind: "money" },
    { name: "salaryMaxAmount", label: "Gehalt max", kind: "money" },
    { name: "status", label: "Status", kind: "select", options: recruitmentStatuses.map((value) => ({ id: value, label: value })) },
    { name: "payTransparencyText", label: "Transparenztext", kind: "textarea", colSpan: 2 },
    { name: "genderNeutralCheck", label: "geschlechtsneutral geprüft", kind: "checkbox" },
    { name: "priorPayQuestionBan", label: "keine Frage nach Vorvergütung", kind: "checkbox" },
  ];

  return (
    <>
      <PageHeader title="Recruiting" description="Einstiegsentgelt, Entgeltspanne und Bewerbungsprozess-Pflichten dokumentieren." />
      <main className="p-6">
        <RecordManager
          title="Recruiting-Vorgänge"
          icon={<BriefcaseBusiness size={18} />}
          endpoint="/api/recruitment"
          rows={rows}
          columns={columns}
          fields={fields}
          searchKeys={["title", "jobProfileTitle", "location"]}
          filters={filters}
          canEdit={canEdit}
          newLabel="Ausschreibung"
          deleteConfirm="Ausschreibung „{title}“ löschen?"
        />
      </main>
    </>
  );
}
