"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, Save, Upload } from "lucide-react";
import { Field, Result, inputClass, isoDate, primaryButton, requestJson } from "@/components/ui/controls";

// Spezial-Anlageformulare, die NICHT über den generischen RecordManager laufen
// (Datei-Upload, Stellenbewertung mit Scoring, Report-Generierung). Alles
// Übrige (Anlegen/Bearbeiten/Löschen) läuft app-weit über den RecordManager.

type Option = { id: string; label: string };
type CriterionOption = Option & { weight: number };

const documentTypes = ["POLICY", "WORKS_AGREEMENT", "JOB_PROFILE", "LEGAL_MEMO", "REPORT", "OFFER", "TEMPLATE", "OTHER"] as const;
const sensitivities = ["PUBLIC_CONFIG", "HR_STRUCTURAL", "PERSONAL_BASIC", "PERSONAL_SENSITIVE", "PAY_SENSITIVE", "PAY_ANALYTICS", "LEGAL_CONFIDENTIAL", "SECURITY"] as const;

function optional(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text ? text : undefined;
}

function FormPanel({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="rounded-md border border-ez-line bg-white">
      <div className="border-b border-ez-line px-4 py-3">
        <h2 className="font-semibold text-ez-navy">{title}</h2>
        <p className="mt-1 text-sm text-ez-muted">{description}</p>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function SubmitButton({ icon, label, busy }: { icon: ReactNode; label: string; busy: boolean }) {
  return (
    <button type="submit" disabled={busy} className={primaryButton}>
      {icon}
      {busy ? "Speichern ..." : label}
    </button>
  );
}

function useSubmitState() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  return {
    busy,
    message,
    error,
    async run(form: HTMLFormElement, action: () => Promise<void>) {
      setBusy(true);
      setMessage(undefined);
      setError(undefined);
      try {
        await action();
        form.reset();
        setMessage("Gespeichert.");
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Speichern fehlgeschlagen");
      } finally {
        setBusy(false);
      }
    },
  };
}

export function JobProfileEvaluationForm({ jobFamilies, comparisonGroups, criteria }: { jobFamilies: Option[]; comparisonGroups: Option[]; criteria: CriterionOption[] }) {
  const state = useSubmitState();
  return (
    <FormPanel title="Stelle bewerten" description="Objektive Stellenbewertung mit gewichteten Kriterien und automatischer Grade-Ableitung.">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          void state.run(form, async () => {
            await requestJson("/api/job-profiles", "POST", {
              title: String(data.get("title")),
              code: String(data.get("code")),
              jobFamilyId: optional(data.get("jobFamilyId")),
              comparisonGroupId: optional(data.get("comparisonGroupId")),
              summary: optional(data.get("summary")),
              responsibilities: optional(data.get("responsibilities")),
              requirements: optional(data.get("requirements")),
              scores: criteria.map((criterion) => ({ criterionId: criterion.id, score: Number(data.get(`score:${criterion.id}`) || 3) })),
            });
          });
        }}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Rolle"><input className={inputClass} name="title" required /></Field>
          <Field label="Code"><input className={inputClass} name="code" placeholder="z. B. MED-MSL-EXPERT" required /></Field>
          <Field label="Jobfamilie"><select className={inputClass} name="jobFamilyId"><option value="">-</option>{jobFamilies.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
          <Field label="Vergleichsgruppe"><select className={inputClass} name="comparisonGroupId"><option value="">-</option>{comparisonGroups.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
        </div>
        <Field label="Kurzbeschreibung"><textarea className={inputClass} name="summary" rows={2} /></Field>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Aufgaben"><textarea className={inputClass} name="responsibilities" rows={3} /></Field>
          <Field label="Anforderungen"><textarea className={inputClass} name="requirements" rows={3} /></Field>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {criteria.map((criterion) => (
            <Field key={criterion.id} label={`${criterion.label} (${criterion.weight}%)`}>
              <select className={inputClass} name={`score:${criterion.id}`} defaultValue="3">
                <option value="1">1 - gering</option>
                <option value="2">2</option>
                <option value="3">3 - mittel</option>
                <option value="4">4</option>
                <option value="5">5 - hoch</option>
              </select>
            </Field>
          ))}
        </div>
        <Result message={state.message} error={state.error} />
        <SubmitButton icon={<Save size={16} />} label="Bewertung speichern" busy={state.busy} />
      </form>
    </FormPanel>
  );
}

export function DocumentUploadForm() {
  const state = useSubmitState();
  return (
    <FormPanel title="Dokument hochladen" description="Dokumente werden versioniert, klassifiziert und verschlüsselt gespeichert.">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          void state.run(form, async () => {
            const response = await fetch("/api/documents/upload", { method: "POST", credentials: "same-origin", body: data });
            const payload = await response.json().catch(() => ({}));
            if (response.status === 401) throw new Error("Nicht authentifiziert. Bitte erneut anmelden.");
            if (!response.ok) throw new Error(payload.error ?? "Upload fehlgeschlagen");
          });
        }}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Titel"><input className={inputClass} name="title" required /></Field>
          <Field label="Typ"><select className={inputClass} name="type">{documentTypes.map((item) => <option key={item}>{item}</option>)}</select></Field>
          <Field label="Sensitivität"><select className={inputClass} name="sensitivity" defaultValue="HR_STRUCTURAL">{sensitivities.map((item) => <option key={item}>{item}</option>)}</select></Field>
          <Field label="Datei"><input className={inputClass} name="file" type="file" required /></Field>
        </div>
        <Result message={state.message} error={state.error} />
        <SubmitButton icon={<Upload size={16} />} label="Dokument hochladen" busy={state.busy} />
      </form>
    </FormPanel>
  );
}

export function ReportGenerateForm() {
  const state = useSubmitState();
  return (
    <FormPanel title="Art.-9-Report generieren" description="Erzeugt einen verschlüsselten CSV-Export mit Pay-Gap-, Variablen- und Quartilskennzahlen.">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          void state.run(form, async () => {
            await requestJson("/api/reports", "POST", { periodStart: isoDate(data.get("periodStart")), periodEnd: isoDate(data.get("periodEnd")) });
          });
        }}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Periode von"><input className={inputClass} name="periodStart" type="date" required /></Field>
          <Field label="Periode bis"><input className={inputClass} name="periodEnd" type="date" required /></Field>
        </div>
        <Result message={state.message} error={state.error} />
        <SubmitButton icon={<FileSpreadsheet size={16} />} label="Report erzeugen" busy={state.busy} />
      </form>
    </FormPanel>
  );
}
