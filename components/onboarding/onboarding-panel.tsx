"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ONBOARDING_ATTESTATION } from "@/lib/domain/onboarding-content";

type ModuleRow = {
  id: string;
  key: string;
  version: number;
  title: string;
  objective: string;
  content: string;
  estimatedMinutes: number;
  required: boolean;
  completedAt?: string;
};

async function completeModule(moduleId: string) {
  const response = await fetch("/api/onboarding/complete", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ moduleId, attest: true }),
  });
  const payload = await response.json().catch(() => ({}));
  if (response.status === 401) throw new Error("Nicht authentifiziert. Bitte erneut anmelden.");
  if (!response.ok) throw new Error(payload.error ?? "Bestaetigung fehlgeschlagen.");
}

export function OnboardingPanel({ modules }: { modules: ModuleRow[] }) {
  const router = useRouter();
  const [busyModuleId, setBusyModuleId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onComplete(moduleId: string) {
    setBusyModuleId(moduleId);
    setError(null);
    try {
      await completeModule(moduleId);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Bestaetigung fehlgeschlagen.");
    } finally {
      setBusyModuleId(null);
    }
  }

  return (
    <div className="space-y-4">
      {error && <div className="rounded-md border border-ez-burgundy-100 bg-ez-burgundy-50 px-3 py-2 text-sm text-ez-burgundy-700">{error}</div>}
      {modules.map((module) => {
        const complete = Boolean(module.completedAt);
        return (
          <section key={module.id} className="rounded-md border border-ez-line bg-white">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ez-line px-4 py-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-ez-navy">{module.title}</h2>
                  <Badge tone={complete ? "good" : "warn"}>{complete ? "abgeschlossen" : "offen"}</Badge>
                  <Badge tone="neutral">v{module.version}</Badge>
                </div>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-ez-muted">{module.objective}</p>
              </div>
              <div className="flex items-center gap-1 text-sm text-ez-muted">
                <Clock size={15} />
                {module.estimatedMinutes} min
              </div>
            </div>
            <div className="space-y-4 p-4">
              <p className="max-w-4xl text-sm leading-7 text-ez-navy">{module.content}</p>
              <div className="rounded-md bg-ez-petrol-50 p-3 text-sm leading-6 text-ez-muted">
                <div className="flex items-center gap-2 font-medium text-ez-navy">
                  <ShieldCheck size={16} />
                  Bestaetigung
                </div>
                <p className="mt-1">{ONBOARDING_ATTESTATION}</p>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-ez-muted">
                  {complete && module.completedAt
                    ? `Nachweis gespeichert am ${new Date(module.completedAt).toLocaleString("de-DE")}`
                    : "Der Abschluss wird mit Zeitstempel, Modulversion und Audit-Event dokumentiert."}
                </div>
                <button
                  type="button"
                  disabled={complete || busyModuleId === module.id}
                  onClick={() => void onComplete(module.id)}
                  className="focus-ring inline-flex items-center gap-2 rounded bg-ez-petrol px-3 py-2 text-sm font-medium text-white hover:bg-ez-navy disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <CheckCircle2 size={16} />
                  {complete ? "Bestaetigt" : busyModuleId === module.id ? "Speichern..." : "Modul bestaetigen"}
                </button>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
