"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { BriefcaseBusiness, FileSpreadsheet, ShieldCheck, Timer, Upload, UserPlus, Save } from "lucide-react";

type Option = { id: string; label: string };
type EmployeeOption = Option & { meta?: string };
type CriterionOption = Option & { weight: number };
type UserOption = Option & { email: string };

const roleOptions = [
  "SYSTEM_ADMIN",
  "SECURITY_ADMIN",
  "HR_ADMIN",
  "HR_ANALYST",
  "COMPENSATION_MANAGER",
  "HR_VIEWER",
  "LEGAL_REVIEWER",
  "EMPLOYEE_REP_REVIEWER",
  "MANAGER_CONTRIBUTOR",
  "AUDITOR",
  "IMPORT_OPERATOR",
] as const;

const documentTypes = ["POLICY", "WORKS_AGREEMENT", "JOB_PROFILE", "LEGAL_MEMO", "REPORT", "OFFER", "TEMPLATE", "OTHER"] as const;
const sensitivities = ["PUBLIC_CONFIG", "HR_STRUCTURAL", "PERSONAL_BASIC", "PERSONAL_SENSITIVE", "PAY_SENSITIVE", "PAY_ANALYTICS", "LEGAL_CONFIDENTIAL", "SECURITY"] as const;
const compensationTypes = ["BASE_SALARY", "VARIABLE_PAY", "BONUS", "ALLOWANCE", "BENEFIT", "COMPANY_CAR", "PENSION", "SPECIAL_PAYMENT", "ONE_TIME_PAYMENT"] as const;
const genders = ["UNKNOWN", "FEMALE", "MALE", "DIVERSE", "NOT_DISCLOSED"] as const;
const retentionActions = ["REVIEW", "ANONYMIZE", "DELETE", "LEGAL_HOLD"] as const;

function optional(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text ? text : undefined;
}

function moneyToCents(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "0").replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  return Math.round(Number(normalized) * 100);
}

function isoDate(value: FormDataEntryValue | null) {
  const text = String(value ?? "");
  return new Date(`${text}T00:00:00.000Z`).toISOString();
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase text-ez-muted">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

const inputClass = "w-full rounded border border-ez-line bg-white px-3 py-2 text-sm outline-none focus:border-ez-petrol";

function FormPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
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

function SubmitButton({ icon, label, busy }: { icon: React.ReactNode; label: string; busy: boolean }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="focus-ring inline-flex items-center gap-2 rounded bg-ez-petrol px-3 py-2 text-sm font-medium text-white hover:bg-ez-navy disabled:cursor-not-allowed disabled:opacity-60"
    >
      {icon}
      {busy ? "Speichern..." : label}
    </button>
  );
}

function Result({ message, error }: { message?: string; error?: string }) {
  if (!message && !error) return null;
  return <div className={`rounded px-3 py-2 text-sm ${error ? "bg-ez-burgundy-50 text-ez-burgundy-700" : "bg-emerald-50 text-emerald-700"}`}>{error ?? message}</div>;
}

async function postJson(path: string, payload: unknown) {
  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) throw new Error("Nicht authentifiziert. Bitte mit dem Systemadmin erneut anmelden und dieselbe URL verwenden.");
  if (!response.ok) throw new Error(data.error ?? "Speichern fehlgeschlagen");
  return data;
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

export function EmployeeCreateForm({
  companies,
  segments,
  sites,
  departments,
  jobProfiles,
  payGrades,
}: {
  companies: Option[];
  segments: Option[];
  sites: Option[];
  departments: Option[];
  jobProfiles: Option[];
  payGrades: Option[];
}) {
  const state = useSubmitState();
  return (
    <FormPanel title="Mitarbeiter anlegen" description="Stammdaten, Pseudonym und Stellenzuordnung fuer HR-Auswertungen erfassen.">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          void state.run(form, async () => {
            await postJson("/api/employees", {
              employeeNumber: String(data.get("employeeNumber")),
              displayName: String(data.get("displayName")),
              pseudonym: String(data.get("pseudonym")),
              companyId: String(data.get("companyId")),
              segmentId: optional(data.get("segmentId")),
              siteId: optional(data.get("siteId")),
              departmentId: optional(data.get("departmentId")),
              gender: String(data.get("gender")),
              fte: Number(data.get("fte") || 1),
              weeklyHours: Number(data.get("weeklyHours") || 40),
              fullTimeHours: Number(data.get("fullTimeHours") || 40),
              jobProfileId: optional(data.get("jobProfileId")),
              payGradeId: optional(data.get("payGradeId")),
            });
          });
        }}
      >
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Personalnr."><input className={inputClass} name="employeeNumber" required /></Field>
          <Field label="Name"><input className={inputClass} name="displayName" required /></Field>
          <Field label="Pseudonym"><input className={inputClass} name="pseudonym" required /></Field>
          <Field label="Gesellschaft">
            <select className={inputClass} name="companyId" required>{companies.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
          </Field>
          <Field label="Segment"><select className={inputClass} name="segmentId"><option value="">-</option>{segments.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
          <Field label="Standort"><select className={inputClass} name="siteId"><option value="">-</option>{sites.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
          <Field label="Abteilung"><select className={inputClass} name="departmentId"><option value="">-</option>{departments.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
          <Field label="Geschlecht"><select className={inputClass} name="gender">{genders.map((item) => <option key={item}>{item}</option>)}</select></Field>
          <Field label="FTE"><input className={inputClass} name="fte" type="number" min="0.01" step="0.01" defaultValue="1" required /></Field>
          <Field label="Wochenstunden"><input className={inputClass} name="weeklyHours" type="number" min="1" step="0.01" defaultValue="40" required /></Field>
          <Field label="Vollzeitstunden"><input className={inputClass} name="fullTimeHours" type="number" min="1" step="0.01" defaultValue="40" required /></Field>
          <Field label="Stellenprofil"><select className={inputClass} name="jobProfileId"><option value="">-</option>{jobProfiles.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
          <Field label="Grade"><select className={inputClass} name="payGradeId"><option value="">-</option>{payGrades.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
        </div>
        <Result message={state.message} error={state.error} />
        <SubmitButton icon={<UserPlus size={16} />} label="Mitarbeiter speichern" busy={state.busy} />
      </form>
    </FormPanel>
  );
}

export function EmployeeImportForm() {
  const state = useSubmitState();
  return (
    <FormPanel title="Mitarbeiter importieren" description="CSV mit employeeNumber, displayName, companyCode, optional gender, fte und Stunden importieren.">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          void state.run(form, async () => {
            const response = await fetch("/api/imports/employees", { method: "POST", credentials: "same-origin", body: data });
            const payload = await response.json().catch(() => ({}));
            if (response.status === 401) throw new Error("Nicht authentifiziert. Bitte erneut anmelden und dieselbe URL verwenden.");
            if (!response.ok) throw new Error(payload.error ?? "Import fehlgeschlagen");
          });
        }}
      >
        <Field label="CSV-Datei"><input className={inputClass} name="file" type="file" accept=".csv,text/csv" required /></Field>
        <Result message={state.message} error={state.error} />
        <SubmitButton icon={<FileSpreadsheet size={16} />} label="CSV importieren" busy={state.busy} />
      </form>
    </FormPanel>
  );
}

export function JobProfileEvaluationForm({
  jobFamilies,
  comparisonGroups,
  criteria,
}: {
  jobFamilies: Option[];
  comparisonGroups: Option[];
  criteria: CriterionOption[];
}) {
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
            await postJson("/api/job-profiles", {
              title: String(data.get("title")),
              code: String(data.get("code")),
              jobFamilyId: optional(data.get("jobFamilyId")),
              comparisonGroupId: optional(data.get("comparisonGroupId")),
              summary: optional(data.get("summary")),
              responsibilities: optional(data.get("responsibilities")),
              requirements: optional(data.get("requirements")),
              scores: criteria.map((criterion) => ({
                criterionId: criterion.id,
                score: Number(data.get(`score:${criterion.id}`) || 3),
              })),
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

export function SalaryBandForm({ payGrades }: { payGrades: Option[] }) {
  const state = useSubmitState();
  return (
    <FormPanel title="Gehaltsband pflegen" description="Min/Mid/Max je Grade und Gueltigkeit erfassen.">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          void state.run(form, async () => {
            await postJson("/api/salary-bands", {
              payGradeId: String(data.get("payGradeId")),
              name: String(data.get("name")),
              currency: String(data.get("currency") || "EUR"),
              fullTimeHours: Number(data.get("fullTimeHours") || 40),
              minAmount: moneyToCents(data.get("minAmount")),
              midAmount: moneyToCents(data.get("midAmount")),
              maxAmount: moneyToCents(data.get("maxAmount")),
              validFrom: isoDate(data.get("validFrom")),
            });
          });
        }}
      >
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Grade"><select className={inputClass} name="payGradeId" required>{payGrades.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
          <Field label="Name"><input className={inputClass} name="name" required /></Field>
          <Field label="Waehrung"><input className={inputClass} name="currency" defaultValue="EUR" minLength={3} maxLength={3} required /></Field>
          <Field label="Vollzeitstunden"><input className={inputClass} name="fullTimeHours" type="number" min="1" step="0.01" defaultValue="40" required /></Field>
          <Field label="Min"><input className={inputClass} name="minAmount" inputMode="decimal" required /></Field>
          <Field label="Mid"><input className={inputClass} name="midAmount" inputMode="decimal" required /></Field>
          <Field label="Max"><input className={inputClass} name="maxAmount" inputMode="decimal" required /></Field>
          <Field label="Gueltig ab"><input className={inputClass} name="validFrom" type="date" required /></Field>
        </div>
        <Result message={state.message} error={state.error} />
        <SubmitButton icon={<Save size={16} />} label="Gehaltsband speichern" busy={state.busy} />
      </form>
    </FormPanel>
  );
}

export function CompensationForm({ employees }: { employees: EmployeeOption[] }) {
  const state = useSubmitState();
  return (
    <FormPanel title="Verguetungsbestandteil erfassen" description="Betrag wird vor Speicherung serverseitig verschluesselt und im Audit protokolliert.">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          void state.run(form, async () => {
            await postJson("/api/compensation", {
              employeeId: String(data.get("employeeId")),
              type: String(data.get("type")),
              label: String(data.get("label")),
              amountCents: moneyToCents(data.get("amount")),
              currency: String(data.get("currency") || "EUR"),
              validFrom: isoDate(data.get("validFrom")),
              validTo: optional(data.get("validTo")) ? isoDate(data.get("validTo")) : undefined,
              legalBasis: optional(data.get("legalBasis")),
              objectiveReason: optional(data.get("objectiveReason")),
            });
          });
        }}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Mitarbeiter"><select className={inputClass} name="employeeId" required>{employees.map((item) => <option key={item.id} value={item.id}>{item.label}{item.meta ? ` · ${item.meta}` : ""}</option>)}</select></Field>
          <Field label="Art"><select className={inputClass} name="type">{compensationTypes.map((item) => <option key={item}>{item}</option>)}</select></Field>
          <Field label="Label"><input className={inputClass} name="label" defaultValue="Jahresgrundgehalt" required /></Field>
          <Field label="Betrag"><input className={inputClass} name="amount" inputMode="decimal" required /></Field>
          <Field label="Waehrung"><input className={inputClass} name="currency" defaultValue="EUR" minLength={3} maxLength={3} required /></Field>
          <Field label="Gueltig ab"><input className={inputClass} name="validFrom" type="date" required /></Field>
          <Field label="Gueltig bis"><input className={inputClass} name="validTo" type="date" /></Field>
          <Field label="Rechts-/Regelbasis"><input className={inputClass} name="legalBasis" /></Field>
        </div>
        <Field label="Objektiver Grund"><textarea className={inputClass} name="objectiveReason" rows={2} /></Field>
        <Result message={state.message} error={state.error} />
        <SubmitButton icon={<ShieldCheck size={16} />} label="Verguetung speichern" busy={state.busy} />
      </form>
    </FormPanel>
  );
}

export function DocumentUploadForm() {
  const state = useSubmitState();
  return (
    <FormPanel title="Dokument hochladen" description="Dokumente werden versioniert, klassifiziert und verschluesselt gespeichert.">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          void state.run(form, async () => {
            const response = await fetch("/api/documents/upload", { method: "POST", credentials: "same-origin", body: data });
            const payload = await response.json().catch(() => ({}));
            if (response.status === 401) throw new Error("Nicht authentifiziert. Bitte erneut anmelden und dieselbe URL verwenden.");
            if (!response.ok) throw new Error(payload.error ?? "Upload fehlgeschlagen");
          });
        }}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Titel"><input className={inputClass} name="title" required /></Field>
          <Field label="Typ"><select className={inputClass} name="type">{documentTypes.map((item) => <option key={item}>{item}</option>)}</select></Field>
          <Field label="Sensitivitaet"><select className={inputClass} name="sensitivity" defaultValue="HR_STRUCTURAL">{sensitivities.map((item) => <option key={item}>{item}</option>)}</select></Field>
          <Field label="Datei"><input className={inputClass} name="file" type="file" required /></Field>
        </div>
        <Result message={state.message} error={state.error} />
        <SubmitButton icon={<Upload size={16} />} label="Dokument hochladen" busy={state.busy} />
      </form>
    </FormPanel>
  );
}

export function UserCreateForm() {
  const state = useSubmitState();
  return (
    <FormPanel title="Benutzer anlegen" description="Lokale Entwicklung oder Azure/Entra-ID-Vorbereitung ohne Kunden-Azure-Zugriff.">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          void state.run(form, async () => {
            await postJson("/api/admin/users", {
              email: String(data.get("email")),
              name: String(data.get("name")),
              authProvider: String(data.get("authProvider")),
              azureObjectId: optional(data.get("azureObjectId")),
              password: optional(data.get("password")),
              role: optional(data.get("role")),
            });
          });
        }}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Name"><input className={inputClass} name="name" required /></Field>
          <Field label="E-Mail"><input className={inputClass} name="email" type="email" required /></Field>
          <Field label="Provider"><select className={inputClass} name="authProvider" defaultValue="LOCAL"><option value="LOCAL">LOCAL</option><option value="AZURE_AD">AZURE_AD</option></select></Field>
          <Field label="Azure Object ID"><input className={inputClass} name="azureObjectId" /></Field>
          <Field label="Startpasswort"><input className={inputClass} name="password" type="password" minLength={12} /></Field>
          <Field label="Initiale Rolle"><select className={inputClass} name="role"><option value="">-</option>{roleOptions.map((item) => <option key={item}>{item}</option>)}</select></Field>
        </div>
        <Result message={state.message} error={state.error} />
        <SubmitButton icon={<UserPlus size={16} />} label="Benutzer speichern" busy={state.busy} />
      </form>
    </FormPanel>
  );
}

export function RoleAssignmentForm({ users }: { users: UserOption[] }) {
  const state = useSubmitState();
  return (
    <FormPanel title="Rolle zuweisen" description="Kritische Rollenvergabe wird als Critical-Audit-Event protokolliert.">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          void state.run(form, async () => {
            await postJson("/api/admin/roles", {
              userId: String(data.get("userId")),
              role: String(data.get("role")),
            });
          });
        }}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Benutzer"><select className={inputClass} name="userId" required>{users.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.email}</option>)}</select></Field>
          <Field label="Rolle"><select className={inputClass} name="role">{roleOptions.map((item) => <option key={item}>{item}</option>)}</select></Field>
        </div>
        <Result message={state.message} error={state.error} />
        <SubmitButton icon={<ShieldCheck size={16} />} label="Rolle zuweisen" busy={state.busy} />
      </form>
    </FormPanel>
  );
}

export function ReportGenerateForm() {
  const state = useSubmitState();
  return (
    <FormPanel title="Art.-9-Report generieren" description="Erzeugt einen verschluesselten CSV-Export mit Pay-Gap-, Variablen- und Quartilskennzahlen.">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          void state.run(form, async () => {
            await postJson("/api/reports", {
              periodStart: isoDate(data.get("periodStart")),
              periodEnd: isoDate(data.get("periodEnd")),
            });
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

export function DisclosureResponseButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={busy}
        className="focus-ring inline-flex items-center gap-2 rounded border border-ez-line bg-white px-2 py-1 text-xs font-medium text-ez-navy hover:border-ez-petrol disabled:opacity-60"
        onClick={async () => {
          setBusy(true);
          setError(undefined);
          try {
            const response = await fetch(`/api/disclosure-requests/${requestId}/response`, { method: "POST", credentials: "same-origin" });
            const payload = await response.json().catch(() => ({}));
            if (response.status === 401) throw new Error("Nicht authentifiziert. Bitte erneut anmelden und dieselbe URL verwenden.");
            if (!response.ok) throw new Error(payload.error ?? "Antwort konnte nicht erzeugt werden");
            router.refresh();
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Antwort konnte nicht erzeugt werden");
          } finally {
            setBusy(false);
          }
        }}
      >
        <ShieldCheck size={14} />
        {busy ? "Erzeuge..." : "Antwort"}
      </button>
      {error && <div className="max-w-48 text-xs text-ez-burgundy-700">{error}</div>}
    </div>
  );
}

export function RemediationForm({ payGapRows, users }: { payGapRows: Option[]; users: UserOption[] }) {
  const state = useSubmitState();
  return (
    <FormPanel title="Abhilfemassnahme anlegen" description="Massnahmen fuer ungeklärte Pay-Gap-Trigger mit Ursache, Verantwortlichem und Frist.">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          void state.run(form, async () => {
            await postJson("/api/remediation", {
              payGapRowId: optional(data.get("payGapRowId")),
              title: String(data.get("title")),
              description: String(data.get("description")),
              rootCause: optional(data.get("rootCause")),
              objectiveReason: optional(data.get("objectiveReason")),
              ownerUserId: optional(data.get("ownerUserId")),
              dueAt: isoDate(data.get("dueAt")),
            });
          });
        }}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Pay-Gap-Zeile"><select className={inputClass} name="payGapRowId"><option value="">-</option>{payGapRows.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
          <Field label="Verantwortlich"><select className={inputClass} name="ownerUserId"><option value="">-</option>{users.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.email}</option>)}</select></Field>
          <Field label="Titel"><input className={inputClass} name="title" required /></Field>
          <Field label="Faellig bis"><input className={inputClass} name="dueAt" type="date" required /></Field>
        </div>
        <Field label="Beschreibung"><textarea className={inputClass} name="description" rows={2} required /></Field>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Ursache"><textarea className={inputClass} name="rootCause" rows={2} /></Field>
          <Field label="Objektiver Grund"><textarea className={inputClass} name="objectiveReason" rows={2} /></Field>
        </div>
        <Result message={state.message} error={state.error} />
        <SubmitButton icon={<Timer size={16} />} label="Massnahme speichern" busy={state.busy} />
      </form>
    </FormPanel>
  );
}

export function RecruitmentPostingForm({ jobProfiles }: { jobProfiles: Option[] }) {
  const state = useSubmitState();
  return (
    <FormPanel title="Recruiting-Transparenz anlegen" description="Gehaltsspanne, Transparenztext und Pflichtchecks fuer Bewerbungsverfahren dokumentieren.">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          void state.run(form, async () => {
            await postJson("/api/recruitment", {
              jobProfileId: optional(data.get("jobProfileId")),
              title: String(data.get("title")),
              location: optional(data.get("location")),
              salaryMinAmount: moneyToCents(data.get("salaryMinAmount")),
              salaryMaxAmount: moneyToCents(data.get("salaryMaxAmount")),
              currency: String(data.get("currency") || "EUR"),
              payTransparencyText: String(data.get("payTransparencyText")),
              genderNeutralCheck: data.get("genderNeutralCheck") === "on",
              priorPayQuestionBan: data.get("priorPayQuestionBan") === "on",
            });
          });
        }}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Stellenprofil"><select className={inputClass} name="jobProfileId"><option value="">-</option>{jobProfiles.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
          <Field label="Titel"><input className={inputClass} name="title" required /></Field>
          <Field label="Standort"><input className={inputClass} name="location" /></Field>
          <Field label="Waehrung"><input className={inputClass} name="currency" defaultValue="EUR" minLength={3} maxLength={3} required /></Field>
          <Field label="Gehalt min"><input className={inputClass} name="salaryMinAmount" inputMode="decimal" required /></Field>
          <Field label="Gehalt max"><input className={inputClass} name="salaryMaxAmount" inputMode="decimal" required /></Field>
        </div>
        <Field label="Transparenztext"><textarea className={inputClass} name="payTransparencyText" rows={3} required /></Field>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2"><input name="genderNeutralCheck" type="checkbox" /> geschlechtsneutral geprueft</label>
          <label className="flex items-center gap-2"><input name="priorPayQuestionBan" type="checkbox" defaultChecked /> keine Frage nach Vorverguetung</label>
        </div>
        <Result message={state.message} error={state.error} />
        <SubmitButton icon={<BriefcaseBusiness size={16} />} label="Posting speichern" busy={state.busy} />
      </form>
    </FormPanel>
  );
}

export function RetentionPolicyForm() {
  const state = useSubmitState();
  return (
    <FormPanel title="Retention Policy pflegen" description="Aufbewahrungs- und Loeschregeln fuer personenbezogene und Compliance-Daten festlegen.">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          void state.run(form, async () => {
            await postJson("/api/retention-policies", {
              entityType: String(data.get("entityType")),
              retentionDays: Number(data.get("retentionDays")),
              action: String(data.get("action")),
              legalBasis: String(data.get("legalBasis")),
              active: data.get("active") === "on",
            });
          });
        }}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Objekttyp"><input className={inputClass} name="entityType" placeholder="z. B. CompensationComponent" required /></Field>
          <Field label="Tage"><input className={inputClass} name="retentionDays" type="number" min="1" required /></Field>
          <Field label="Aktion"><select className={inputClass} name="action">{retentionActions.map((item) => <option key={item}>{item}</option>)}</select></Field>
          <Field label="Rechtsgrundlage"><input className={inputClass} name="legalBasis" required /></Field>
        </div>
        <label className="flex items-center gap-2 text-sm"><input name="active" type="checkbox" defaultChecked /> aktiv</label>
        <Result message={state.message} error={state.error} />
        <SubmitButton icon={<Timer size={16} />} label="Policy speichern" busy={state.busy} />
      </form>
    </FormPanel>
  );
}
