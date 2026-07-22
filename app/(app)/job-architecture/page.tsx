import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { JobProfileEvaluationForm, JobProfileManageForm } from "@/components/forms/hr-admin-forms";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/session";
import { hasPermission } from "@/lib/security/permissions";

export default async function JobArchitecturePage() {
  const ctx = await requireAuth();
  const canEdit = hasPermission(ctx.roles, "job:edit");
  const [profiles, criteria, jobFamilies, comparisonGroups, payGrades] = await Promise.all([
    prisma.jobProfile.findMany({
      where: { tenantId: ctx.tenantId },
      include: { jobFamily: true, payGrade: true, comparisonGroup: true },
      orderBy: [{ code: "asc" }, { version: "desc" }],
    }),
    prisma.evaluationCriterion.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { sortOrder: "asc" } }),
    prisma.jobFamily.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { name: "asc" } }),
    prisma.comparisonGroup.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { name: "asc" } }),
    prisma.payGrade.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <>
      <PageHeader
        title="Jobarchitektur"
        description="Rollenbewertung nach Kompetenz, Verantwortung, Belastung und Arbeitsbedingungen. Bewertet wird die Stelle, nicht die Person."
        action={
          canEdit ? (
            <Link className="focus-ring rounded bg-ez-petrol px-3 py-2 text-sm font-medium text-white hover:bg-ez-navy" href="/job-architecture/ai-assistant">
              KI-Assist
            </Link>
          ) : undefined
        }
      />
      <main className="grid gap-6 p-6 xl:grid-cols-[1fr_360px]">
        {canEdit && (
          <div className="space-y-6 xl:col-span-2">
            <JobProfileEvaluationForm
              jobFamilies={jobFamilies.map((item) => ({ id: item.id, label: `${item.name} (${item.code})` }))}
              comparisonGroups={comparisonGroups.map((item) => ({ id: item.id, label: `${item.name} (${item.code})` }))}
              criteria={criteria.map((item) => ({ id: item.id, label: item.name, weight: item.weight }))}
            />
            <JobProfileManageForm
              profiles={profiles.map((profile) => ({
                id: profile.id,
                label: `${profile.code} · ${profile.title}`,
                title: profile.title,
                code: profile.code,
                status: profile.status,
                jobFamilyId: profile.jobFamilyId,
                comparisonGroupId: profile.comparisonGroupId,
                payGradeId: profile.payGradeId,
                summary: profile.summary ?? "",
                responsibilities: profile.responsibilities ?? "",
                requirements: profile.requirements ?? "",
              }))}
              jobFamilies={jobFamilies.map((item) => ({ id: item.id, label: `${item.name} (${item.code})` }))}
              comparisonGroups={comparisonGroups.map((item) => ({ id: item.id, label: `${item.name} (${item.code})` }))}
              payGrades={payGrades.map((item) => ({ id: item.id, label: `${item.code} · ${item.name}` }))}
            />
          </div>
        )}
        <div className="overflow-hidden rounded-md border border-ez-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-ez-bg text-xs uppercase text-ez-muted">
              <tr>
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">Rolle</th>
                <th className="px-3 py-2">Jobfamilie</th>
                <th className="px-3 py-2">Punkte</th>
                <th className="px-3 py-2">Grade</th>
                <th className="px-3 py-2">Vergleichsgruppe</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((profile) => (
                <tr key={profile.id} className="border-t border-ez-line">
                  <td className="px-3 py-2 font-mono text-xs">{profile.code}</td>
                  <td className="px-3 py-2 font-medium">{profile.title}</td>
                  <td className="px-3 py-2">{profile.jobFamily?.name ?? "-"}</td>
                  <td className="px-3 py-2">{profile.totalPoints ?? "-"}</td>
                  <td className="px-3 py-2">{profile.payGrade?.code ?? "-"}</td>
                  <td className="px-3 py-2">{profile.comparisonGroup?.name ?? "-"}</td>
                  <td className="px-3 py-2"><Badge tone={profile.status === "APPROVED" ? "good" : "warn"}>{profile.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <aside className="rounded-md border border-ez-line bg-white p-4">
          <h2 className="font-semibold text-ez-navy">Bewertungskriterien</h2>
          <div className="mt-4 space-y-3">
            {criteria.map((criterion) => (
              <div key={criterion.id} className="rounded border border-ez-line p-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{criterion.name}</div>
                  <Badge>{criterion.weight}%</Badge>
                </div>
                <p className="mt-1 text-sm text-ez-muted">{criterion.description ?? "EIGE-/Richtlinienkriterium"}</p>
              </div>
            ))}
          </div>
        </aside>
      </main>
    </>
  );
}
