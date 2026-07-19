import { BookOpenCheck, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { OnboardingPanel } from "@/components/onboarding/onboarding-panel";
import { Badge } from "@/components/ui/badge";
import { requireAuth } from "@/lib/auth/session";
import { completionPercent, getActiveOnboardingModules, moduleAppliesToRoles } from "@/lib/domain/onboarding";
import { prisma } from "@/lib/db/prisma";

export default async function OnboardingPage() {
  const ctx = await requireAuth();
  const allModules = await getActiveOnboardingModules(ctx.tenantId);
  const modules = allModules.filter((module) => moduleAppliesToRoles(module, ctx.roles));
  const completions = await prisma.onboardingCompletion.findMany({
    where: {
      tenantId: ctx.tenantId,
      userId: ctx.user.id,
      OR: modules.map((module) => ({ moduleKey: module.key, moduleVersion: module.version })),
    },
  });
  const completionByModule = new Map(completions.map((completion) => [`${completion.moduleKey}:${completion.moduleVersion}`, completion]));
  const completedCount = modules.filter((module) => completionByModule.has(`${module.key}:${module.version}`)).length;
  const percent = completionPercent(completedCount, modules.length);

  return (
    <>
      <PageHeader
        title="Onboarding"
        description="Auditierbarer Schulungsplan fuer sichere Nutzung, Rollenverantwortung und Umgang mit sensiblen Entgeltdaten."
      />
      <main className="space-y-6 p-6">
        <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="rounded-md border border-ez-line bg-white p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-md bg-ez-petrol-50 p-2 text-ez-petrol">
                <BookOpenCheck size={22} />
              </div>
              <div>
                <h2 className="font-semibold text-ez-navy">Schulungsnachweis</h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-ez-muted">
                  Jeder Abschluss speichert Benutzer, Modulversion, Inhalts-Hash, Zeitstempel, technische Request-Metadaten und ein Audit-Event.
                  Damit kann HR im Audit belegen, dass Benutzer vor der Arbeit mit dem Tool geschult wurden.
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-md border border-ez-line bg-white p-5">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-ez-muted">Persoenlicher Fortschritt</div>
              <Badge tone={percent === 100 ? "good" : "warn"}>{percent}%</Badge>
            </div>
            <div className="mt-4 h-2 rounded bg-ez-line">
              <div className="h-2 rounded bg-ez-petrol" style={{ width: `${percent}%` }} />
            </div>
            <div className="mt-3 flex items-center gap-2 text-sm text-ez-muted">
              <ShieldCheck size={16} />
              {completedCount} von {modules.length} relevanten Modulen bestaetigt
            </div>
          </div>
        </section>

        <OnboardingPanel
          modules={modules.map((module) => {
            const completion = completionByModule.get(`${module.key}:${module.version}`);
            return {
              id: module.id,
              key: module.key,
              version: module.version,
              title: module.title,
              objective: module.objective,
              content: module.content,
              estimatedMinutes: module.estimatedMinutes,
              required: module.required,
              completedAt: completion?.completedAt.toISOString(),
            };
          })}
        />
      </main>
    </>
  );
}
