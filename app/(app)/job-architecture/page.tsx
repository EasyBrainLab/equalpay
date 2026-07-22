import Link from "next/link";
import { Building2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { RecordManager, type ColumnDef, type FieldDef, type FilterDef } from "@/components/data/record-manager";
import { JobProfileEvaluationForm } from "@/components/forms/hr-admin-forms";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/session";
import { hasPermission } from "@/lib/security/permissions";

const evaluationStatuses = ["DRAFT", "IN_REVIEW", "APPROVED", "ARCHIVED"];

export default async function JobArchitecturePage() {
  const ctx = await requireAuth();
  const canEdit = hasPermission(ctx.roles, "job:edit");
  const [profiles, criteria, jobFamilies, comparisonGroups, payGrades] = await Promise.all([
    prisma.jobProfile.findMany({ where: { tenantId: ctx.tenantId }, include: { jobFamily: true, payGrade: true, comparisonGroup: true }, orderBy: [{ code: "asc" }, { version: "desc" }] }),
    prisma.evaluationCriterion.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { sortOrder: "asc" } }),
    prisma.jobFamily.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { name: "asc" } }),
    prisma.comparisonGroup.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { name: "asc" } }),
    prisma.payGrade.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { sortOrder: "asc" } }),
  ]);

  const jobFamilyOptions = jobFamilies.map((item) => ({ id: item.id, label: `${item.name} (${item.code})` }));
  const comparisonOptions = comparisonGroups.map((item) => ({ id: item.id, label: `${item.name} (${item.code})` }));
  const payGradeOptions = payGrades.map((item) => ({ id: item.id, label: `${item.code} · ${item.name}` }));

  const rows = profiles.map((profile) => ({
    id: profile.id,
    code: profile.code,
    title: profile.title,
    jobFamilyName: profile.jobFamily?.name ?? "-",
    totalPoints: profile.totalPoints !== null ? String(profile.totalPoints) : "-",
    payGradeCode: profile.payGrade?.code ?? "-",
    status: profile.status,
    jobFamilyId: profile.jobFamilyId,
    comparisonGroupId: profile.comparisonGroupId,
    payGradeId: profile.payGradeId,
    summary: profile.summary,
    responsibilities: profile.responsibilities,
    requirements: profile.requirements,
  }));

  const columns: ColumnDef[] = [
    { key: "code", header: "Code", kind: "code" },
    { key: "title", header: "Rolle" },
    { key: "jobFamilyName", header: "Jobfamilie" },
    { key: "totalPoints", header: "Punkte" },
    { key: "payGradeCode", header: "Grade" },
    { key: "status", header: "Status", kind: "badge", tone: { APPROVED: "good", "*": "warn" } },
  ];

  const filters: FilterDef[] = [{ field: "status", label: "Status", options: [{ value: "", label: "Alle Status" }, ...evaluationStatuses.map((value) => ({ value, label: value }))] }];

  const fields: FieldDef[] = [
    { name: "title", label: "Rolle" },
    { name: "code", label: "Code" },
    { name: "jobFamilyId", label: "Jobfamilie", kind: "select", options: jobFamilyOptions, optional: true },
    { name: "comparisonGroupId", label: "Vergleichsgruppe", kind: "select", options: comparisonOptions, optional: true },
    { name: "payGradeId", label: "Grade", kind: "select", options: payGradeOptions, optional: true },
    { name: "status", label: "Status", kind: "select", options: evaluationStatuses.map((value) => ({ id: value, label: value })) },
    { name: "summary", label: "Kurzbeschreibung", kind: "textarea", optional: true, colSpan: 2 },
    { name: "responsibilities", label: "Aufgaben", kind: "textarea", optional: true, colSpan: 2 },
    { name: "requirements", label: "Anforderungen", kind: "textarea", optional: true, colSpan: 2 },
  ];

  return (
    <>
      <PageHeader
        title="Jobarchitektur"
        description="Rollenbewertung nach Kompetenz, Verantwortung, Belastung und Arbeitsbedingungen. Bewertet wird die Stelle, nicht die Person."
        action={canEdit ? (<Link className="focus-ring rounded bg-ez-petrol px-3 py-2 text-sm font-medium text-white hover:bg-ez-navy" href="/job-architecture/ai-assistant">KI-Assist</Link>) : undefined}
      />
      <main className="space-y-6 p-6">
        {canEdit && (
          <JobProfileEvaluationForm
            jobFamilies={jobFamilyOptions}
            comparisonGroups={comparisonOptions}
            criteria={criteria.map((item) => ({ id: item.id, label: item.name, weight: item.weight }))}
          />
        )}
        <RecordManager
          title="Stellenprofile"
          icon={<Building2 size={18} />}
          endpoint="/api/job-profiles"
          rows={rows}
          columns={columns}
          fields={fields}
          searchKeys={["code", "title", "jobFamilyName"]}
          filters={filters}
          canEdit={canEdit}
          canCreate={false}
          deleteConfirm="Stellenprofil „{code} · {title}“ löschen?"
        />
      </main>
    </>
  );
}
