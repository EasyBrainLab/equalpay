import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { RecruitmentPostingForm } from "@/components/forms/hr-admin-forms";
import { prisma } from "@/lib/db/prisma";
import { formatMoney } from "@/lib/domain/money";
import { requireAuth } from "@/lib/auth/session";
import { hasPermission } from "@/lib/security/permissions";

export default async function RecruitmentPage() {
  const ctx = await requireAuth();
  const canEdit = hasPermission(ctx.roles, "recruitment:edit");
  const [postings, jobProfiles] = await Promise.all([
    prisma.recruitmentPosting.findMany({ where: { tenantId: ctx.tenantId }, include: { jobProfile: true }, orderBy: { updatedAt: "desc" } }),
    prisma.jobProfile.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { title: "asc" } }),
  ]);

  return (
    <>
      <PageHeader title="Recruiting" description="Einstiegsentgelt, Entgeltspanne und Bewerbungsprozess-Pflichten dokumentieren." />
      <main className="space-y-6 p-6">
        {canEdit && <RecruitmentPostingForm jobProfiles={jobProfiles.map((item) => ({ id: item.id, label: `${item.title} (${item.code})` }))} />}
        <section className="overflow-hidden rounded-md border border-ez-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-ez-bg text-xs uppercase text-ez-muted">
              <tr>
                <th className="px-3 py-2">Position</th>
                <th className="px-3 py-2">Stelle</th>
                <th className="px-3 py-2">Spanne</th>
                <th className="px-3 py-2">Checks</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {postings.map((posting) => (
                <tr key={posting.id} className="border-t border-ez-line align-top">
                  <td className="px-3 py-2"><div className="font-medium">{posting.title}</div><div className="text-ez-muted">{posting.location ?? "-"}</div></td>
                  <td className="px-3 py-2">{posting.jobProfile?.title ?? "-"}</td>
                  <td className="px-3 py-2">{formatMoney(posting.salaryMinAmount, posting.currency)} bis {formatMoney(posting.salaryMaxAmount, posting.currency)}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      <Badge tone={posting.genderNeutralCheck ? "good" : "warn"}>neutral</Badge>
                      <Badge tone={posting.priorPayQuestionBan ? "good" : "danger"}>keine Vorverguetung</Badge>
                    </div>
                  </td>
                  <td className="px-3 py-2"><Badge tone={posting.status === "APPROVED" || posting.status === "PUBLISHED" ? "good" : "warn"}>{posting.status}</Badge></td>
                </tr>
              ))}
              {!postings.length && (
                <tr><td className="px-3 py-6 text-ez-muted" colSpan={5}>Noch keine Recruiting-Vorgaenge angelegt.</td></tr>
              )}
            </tbody>
          </table>
        </section>
      </main>
    </>
  );
}
