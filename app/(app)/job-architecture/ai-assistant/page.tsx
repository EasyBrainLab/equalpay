import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { AiJobDraftTransferForm, AiJobDraftUploadForm } from "@/components/forms/ai-job-assistant-forms";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/session";
import { hasPermission } from "@/lib/security/permissions";

type DraftAnalysis = {
  summary?: string;
  responsibilities?: string;
  requirements?: string;
  criteria?: Array<{ name: string; score: number; weighted: number; evidence: string }>;
  evidence?: Array<{ criterion: string; excerpt: string; reasoning: string }>;
};

function statusTone(status: string) {
  if (status === "TRANSFERRED" || status === "APPROVED") return "good" as const;
  if (status === "REJECTED") return "danger" as const;
  return "warn" as const;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export default async function AiJobAssistantPage() {
  const ctx = await requireAuth();
  const canAssist = hasPermission(ctx.roles, "job:ai-assist");
  const canTransfer = hasPermission(ctx.roles, "job:edit");
  const [drafts, companies] = await Promise.all([
    prisma.aiJobArchitectureDraft.findMany({
      where: { tenantId: ctx.tenantId },
      include: { promptVersion: true, transferredJobProfile: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.company.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <PageHeader
        title="KI Job Architecture Assistant"
        description="Sicherer Entwurfsprozess fuer Stellenbeschreibungen: lokale Extraktion, Prompt-Version, heuristischer Vorschlag, Human Review und Transfer in die Jobarchitektur."
      />
      <main className="space-y-6 p-6">
        {canAssist && <AiJobDraftUploadForm companies={companies.map((company) => ({ id: company.code, label: `${company.name} (${company.code})` }))} />}

        <section className="space-y-4">
          {drafts.map((draft) => {
            const analysis = draft.analysisJson as DraftAnalysis;
            const missing = toStringArray(draft.missingInformation);
            const warnings = toStringArray(draft.biasWarnings);
            return (
              <article key={draft.id} className="rounded-md border border-ez-line bg-white">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ez-line px-4 py-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-ez-navy">{draft.suggestedTitle ?? draft.sourceFileName}</h2>
                      <Badge tone={statusTone(draft.status)}>{draft.status}</Badge>
                      <Badge tone="neutral">{draft.placeholderProvider}</Badge>
                    </div>
                    <div className="mt-1 text-sm text-ez-muted">
                      {draft.sourceFileName} · {draft.businessUnit ?? "Business Unit offen"} · Prompt {draft.promptVersion.version}
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="font-semibold text-ez-navy">{draft.suggestedGradeCode ?? "-"} · {draft.suggestedTotalPoints ?? "-"} Punkte</div>
                    <div className="text-ez-muted">Confidence {draft.confidence ? Number(draft.confidence).toFixed(3) : "-"}</div>
                  </div>
                </div>

                <div className="grid gap-4 p-4 xl:grid-cols-[1fr_360px]">
                  <div className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded border border-ez-line p-3">
                        <div className="text-xs font-semibold uppercase text-ez-muted">Code</div>
                        <div className="mt-1 font-medium">{draft.suggestedCode ?? "-"}</div>
                      </div>
                      <div className="rounded border border-ez-line p-3">
                        <div className="text-xs font-semibold uppercase text-ez-muted">Jobfamilie</div>
                        <div className="mt-1 font-medium">{draft.suggestedJobFamily ?? "-"}</div>
                      </div>
                      <div className="rounded border border-ez-line p-3">
                        <div className="text-xs font-semibold uppercase text-ez-muted">Vergleichsgruppe</div>
                        <div className="mt-1 font-medium">{draft.suggestedComparisonGroup ?? "-"}</div>
                      </div>
                    </div>

                    <div className="rounded border border-ez-line p-3">
                      <h3 className="font-semibold text-ez-navy">Vorschlag und Evidenz</h3>
                      <p className="mt-2 text-sm leading-6 text-ez-muted">{analysis.summary ?? "Keine Zusammenfassung vorhanden."}</p>
                      <div className="mt-3 overflow-hidden rounded border border-ez-line">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-ez-bg text-xs uppercase text-ez-muted">
                            <tr>
                              <th className="px-3 py-2">Kriterium</th>
                              <th className="px-3 py-2">Score</th>
                              <th className="px-3 py-2">Gewichtet</th>
                              <th className="px-3 py-2">Evidenz</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(analysis.criteria ?? []).map((criterion) => (
                              <tr key={criterion.name} className="border-t border-ez-line align-top">
                                <td className="px-3 py-2 font-medium">{criterion.name}</td>
                                <td className="px-3 py-2">{criterion.score}/5</td>
                                <td className="px-3 py-2">{criterion.weighted}</td>
                                <td className="px-3 py-2 text-ez-muted">{criterion.evidence}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  <aside className="space-y-4">
                    <div className="rounded border border-ez-line p-3">
                      <h3 className="font-semibold text-ez-navy">Review-Hinweise</h3>
                      <div className="mt-3 space-y-3">
                        <div>
                          <div className="text-xs font-semibold uppercase text-ez-muted">Fehlende Informationen</div>
                          <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-ez-muted">
                            {(missing.length ? missing : ["Keine automatischen Luecken erkannt."]).map((item) => <li key={item}>{item}</li>)}
                          </ul>
                        </div>
                        <div>
                          <div className="text-xs font-semibold uppercase text-ez-muted">Bias-Warnungen</div>
                          <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-ez-muted">
                            {(warnings.length ? warnings : ["Keine automatischen Bias-Warnungen erkannt."]).map((item) => <li key={item}>{item}</li>)}
                          </ul>
                        </div>
                      </div>
                    </div>

                    <div className="rounded border border-ez-line p-3">
                      <h3 className="font-semibold text-ez-navy">Uebernahme</h3>
                      <p className="mt-1 text-sm text-ez-muted">
                        Die Uebernahme erzeugt ein Jobprofil im Status IN_REVIEW. Der KI-Entwurf bleibt als Nachweis erhalten.
                      </p>
                      <div className="mt-3">
                        {draft.transferredJobProfile ? (
                          <div className="rounded bg-emerald-50 p-3 text-sm text-emerald-700">
                            Uebernommen als {draft.transferredJobProfile.code}, Version {draft.transferredJobProfile.version}.
                          </div>
                        ) : canTransfer ? (
                          <AiJobDraftTransferForm draftId={draft.id} disabled={draft.status === "REJECTED"} />
                        ) : (
                          <div className="rounded bg-ez-bg p-3 text-sm text-ez-muted">Keine Berechtigung zur Uebernahme.</div>
                        )}
                      </div>
                    </div>
                  </aside>
                </div>
              </article>
            );
          })}
          {!drafts.length && (
            <div className="rounded-md border border-dashed border-ez-line bg-white p-8 text-sm text-ez-muted">
              Noch keine KI-Jobarchitektur-Entwuerfe vorhanden.
            </div>
          )}
        </section>
      </main>
    </>
  );
}
