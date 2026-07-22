"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { BriefcaseBusiness, FileSpreadsheet, KeyRound, Pencil, ShieldCheck, Timer, Trash2, Upload, UserPlus, Save } from "lucide-react";

type Option = { id: string; label: string };
type EmployeeOption = Option & { meta?: string };
type CriterionOption = Option & { weight: number };
type UserOption = Option & { email: string };
type ManagedUserOption = UserOption & { authProvider: "LOCAL" | "AZURE_AD"; azureObjectId?: string | null; status: "ACTIVE" | "INVITED" | "DISABLED"; roles: string[] };

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

// Cent-Betrag für ein Eingabefeld darstellen (deutsches Dezimalkomma, kompatibel zu moneyToCents).
function centsToInput(cents: number) {
  return (cents / 100).toString().replace(".", ",");
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

async function requestJson(path: string, method: "POST" | "PATCH" | "DELETE", payload: unknown) {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) throw new Error("Nicht authentifiziert. Bitte erneut anmelden und dieselbe URL verwenden.");
  if (!response.ok) throw new Error(data.error ?? "Speichern fehlgeschlagen");
  return data;
}

async function postJson(path: string, payload: unknown) {
  return requestJson(path, "POST", payload);
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

export function UserManagementForm({ users, currentUserId }: { users: ManagedUserOption[]; currentUserId: string }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(users[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const selected = users.find((user) => user.id === selectedId) ?? users[0];

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true);
    setMessage(undefined);
    setError(undefined);
    try {
      await action();
      setMessage(success);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Aktion fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  if (!selected) {
    return (
      <FormPanel title="Benutzer verwalten" description="Benutzer bearbeiten, deaktivieren und Passwoerter zuruecksetzen.">
        <div className="text-sm text-ez-muted">Noch keine Benutzer vorhanden.</div>
      </FormPanel>
    );
  }

  return (
    <FormPanel title="Benutzer verwalten" description="Stammdaten, Provider, Status, Rollen und lokale Passwoerter administrieren.">
      <div className="space-y-4">
        <Field label="Benutzer auswaehlen">
          <select className={inputClass} value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
            {users.map((user) => (
              <option key={user.id} value={user.id}>{user.label} · {user.email}</option>
            ))}
          </select>
        </Field>

        <form
          key={selected.id}
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void run(async () => {
              await requestJson("/api/admin/users", "PATCH", {
                userId: selected.id,
                name: String(data.get("name")),
                email: String(data.get("email")),
                authProvider: String(data.get("authProvider")),
                azureObjectId: optional(data.get("azureObjectId")),
                status: String(data.get("status")),
                roles: roleOptions.filter((role) => data.get(`role:${role}`) === "on"),
              });
            }, "Benutzer aktualisiert.");
          }}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Name"><input className={inputClass} name="name" defaultValue={selected.label} required /></Field>
            <Field label="E-Mail"><input className={inputClass} name="email" type="email" defaultValue={selected.email} required /></Field>
            <Field label="Provider">
              <select className={inputClass} name="authProvider" defaultValue={selected.authProvider}>
                <option value="LOCAL">LOCAL</option>
                <option value="AZURE_AD">AZURE_AD</option>
              </select>
            </Field>
            <Field label="Status">
              <select className={inputClass} name="status" defaultValue={selected.status}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INVITED">INVITED</option>
                <option value="DISABLED">DISABLED</option>
              </select>
            </Field>
            <Field label="Azure Object ID"><input className={inputClass} name="azureObjectId" defaultValue={selected.azureObjectId ?? ""} /></Field>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase text-ez-muted">Rollen</div>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {roleOptions.map((role) => (
                <label key={role} className="flex items-center gap-2 rounded border border-ez-line px-3 py-2 text-sm">
                  <input name={`role:${role}`} type="checkbox" defaultChecked={selected.roles.includes(role)} />
                  {role}
                </label>
              ))}
            </div>
          </div>

          <Field label="Neues Passwort fuer Reset">
            <input className={inputClass} name="resetPassword" type="password" minLength={12} autoComplete="new-password" />
          </Field>

          <Result message={message} error={error} />
          <div className="flex flex-wrap gap-2">
            <SubmitButton icon={<Pencil size={16} />} label="Benutzer aktualisieren" busy={busy} />
            <button
              type="button"
              disabled={busy || selected.authProvider !== "LOCAL"}
              className="focus-ring inline-flex items-center gap-2 rounded border border-ez-line bg-white px-3 py-2 text-sm font-medium text-ez-navy hover:border-ez-petrol disabled:cursor-not-allowed disabled:opacity-60"
              onClick={(event) => {
                const form = event.currentTarget.form;
                const passwordInput = form?.elements.namedItem("resetPassword");
                const password = passwordInput instanceof HTMLInputElement ? passwordInput.value : "";
                if (!password) {
                  setError("Bitte zuerst ein neues Passwort eingeben.");
                  setMessage(undefined);
                  return;
                }
                void run(async () => {
                  await requestJson("/api/admin/users", "PATCH", { action: "resetPassword", userId: selected.id, password });
                  if (passwordInput instanceof HTMLInputElement) passwordInput.value = "";
                }, "Passwort zurueckgesetzt. Bestehende Sessions wurden geloescht.");
              }}
            >
              <KeyRound size={16} />
              Passwort zuruecksetzen
            </button>
            <button
              type="button"
              disabled={busy || selected.id === currentUserId || selected.status === "DISABLED"}
              className="focus-ring inline-flex items-center gap-2 rounded border border-ez-burgundy-100 bg-white px-3 py-2 text-sm font-medium text-ez-burgundy-700 hover:bg-ez-burgundy-50 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => {
                if (!window.confirm(`Benutzer ${selected.email} deaktivieren? Der Login wird gesperrt und aktive Sessions werden geloescht.`)) return;
                void run(async () => {
                  await requestJson("/api/admin/users", "DELETE", { userId: selected.id });
                }, "Benutzer deaktiviert.");
              }}
            >
              <Trash2 size={16} />
              Benutzer loeschen/deaktivieren
            </button>
          </div>
        </form>
      </div>
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

type EmployeeRow = {
  id: string;
  employeeNumber: string;
  displayName: string;
  pseudonym: string;
  companyId: string;
  segmentId: string | null;
  siteId: string | null;
  departmentId: string | null;
  gender: string;
  status: string;
  fte: number;
  weeklyHours: number;
  fullTimeHours: number;
  jobProfileId: string | null;
  payGradeId: string | null;
};

const employmentStatuses = ["ACTIVE", "LEAVE", "TERMINATED"] as const;

function DeleteButton({ label, busy, onClick }: { label: string; busy: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={busy}
      className="focus-ring inline-flex items-center gap-2 rounded border border-ez-burgundy-100 bg-white px-3 py-2 text-sm font-medium text-ez-burgundy-700 hover:bg-ez-burgundy-50 disabled:cursor-not-allowed disabled:opacity-60"
      onClick={onClick}
    >
      <Trash2 size={16} />
      {label}
    </button>
  );
}

export function EmployeeManageForm({
  employees,
  companies,
  segments,
  sites,
  departments,
  jobProfiles,
  payGrades,
}: {
  employees: EmployeeRow[];
  companies: Option[];
  segments: Option[];
  sites: Option[];
  departments: Option[];
  jobProfiles: Option[];
  payGrades: Option[];
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(employees[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const selected = employees.find((employee) => employee.id === selectedId) ?? employees[0];

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true);
    setMessage(undefined);
    setError(undefined);
    try {
      await action();
      setMessage(success);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Aktion fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  if (!selected) {
    return (
      <FormPanel title="Mitarbeiter bearbeiten" description="Bestehende Mitarbeitende ändern oder löschen.">
        <div className="text-sm text-ez-muted">Noch keine Mitarbeitenden vorhanden.</div>
      </FormPanel>
    );
  }

  return (
    <FormPanel title="Mitarbeiter bearbeiten" description="Stammdaten, Zuordnung und Status bestehender Mitarbeitender ändern oder löschen (mit Audit-Protokoll).">
      <div className="space-y-4">
        <Field label="Mitarbeiter auswaehlen">
          <select className={inputClass} value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>{employee.displayName} · {employee.employeeNumber}</option>
            ))}
          </select>
        </Field>
        <form
          key={selected.id}
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void run(async () => {
              await requestJson("/api/employees", "PATCH", {
                id: selected.id,
                employeeNumber: String(data.get("employeeNumber")),
                displayName: String(data.get("displayName")),
                pseudonym: String(data.get("pseudonym")),
                companyId: String(data.get("companyId")),
                segmentId: optional(data.get("segmentId")) ?? null,
                siteId: optional(data.get("siteId")) ?? null,
                departmentId: optional(data.get("departmentId")) ?? null,
                gender: String(data.get("gender")),
                status: String(data.get("status")),
                fte: Number(data.get("fte") || 1),
                weeklyHours: Number(data.get("weeklyHours") || 40),
                fullTimeHours: Number(data.get("fullTimeHours") || 40),
                jobProfileId: optional(data.get("jobProfileId")) ?? null,
                payGradeId: optional(data.get("payGradeId")) ?? null,
              });
            }, "Mitarbeiter aktualisiert.");
          }}
        >
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Personalnr."><input className={inputClass} name="employeeNumber" defaultValue={selected.employeeNumber} required /></Field>
            <Field label="Name"><input className={inputClass} name="displayName" defaultValue={selected.displayName} required /></Field>
            <Field label="Pseudonym"><input className={inputClass} name="pseudonym" defaultValue={selected.pseudonym} required /></Field>
            <Field label="Gesellschaft"><select className={inputClass} name="companyId" defaultValue={selected.companyId} required>{companies.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
            <Field label="Segment"><select className={inputClass} name="segmentId" defaultValue={selected.segmentId ?? ""}><option value="">-</option>{segments.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
            <Field label="Standort"><select className={inputClass} name="siteId" defaultValue={selected.siteId ?? ""}><option value="">-</option>{sites.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
            <Field label="Abteilung"><select className={inputClass} name="departmentId" defaultValue={selected.departmentId ?? ""}><option value="">-</option>{departments.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
            <Field label="Geschlecht"><select className={inputClass} name="gender" defaultValue={selected.gender}>{genders.map((item) => <option key={item}>{item}</option>)}</select></Field>
            <Field label="Status"><select className={inputClass} name="status" defaultValue={selected.status}>{employmentStatuses.map((item) => <option key={item}>{item}</option>)}</select></Field>
            <Field label="FTE"><input className={inputClass} name="fte" type="number" min="0.01" step="0.01" defaultValue={selected.fte} required /></Field>
            <Field label="Wochenstunden"><input className={inputClass} name="weeklyHours" type="number" min="1" step="0.01" defaultValue={selected.weeklyHours} required /></Field>
            <Field label="Vollzeitstunden"><input className={inputClass} name="fullTimeHours" type="number" min="1" step="0.01" defaultValue={selected.fullTimeHours} required /></Field>
            <Field label="Stellenprofil"><select className={inputClass} name="jobProfileId" defaultValue={selected.jobProfileId ?? ""}><option value="">-</option>{jobProfiles.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
            <Field label="Grade"><select className={inputClass} name="payGradeId" defaultValue={selected.payGradeId ?? ""}><option value="">-</option>{payGrades.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
          </div>
          <Result message={message} error={error} />
          <div className="flex flex-wrap gap-2">
            <SubmitButton icon={<Pencil size={16} />} label="Mitarbeiter aktualisieren" busy={busy} />
            <DeleteButton
              label="Mitarbeiter loeschen"
              busy={busy}
              onClick={() => {
                if (!window.confirm(`Mitarbeiter ${selected.displayName} (${selected.employeeNumber}) endgueltig loeschen? Mitarbeitende mit Verguetungshistorie koennen nicht geloescht, sondern nur auf Status TERMINATED gesetzt werden.`)) return;
                void run(async () => {
                  await requestJson("/api/employees", "DELETE", { id: selected.id });
                  setSelectedId("");
                }, "Mitarbeiter geloescht.");
              }}
            />
          </div>
        </form>
      </div>
    </FormPanel>
  );
}

type SalaryBandRow = {
  id: string;
  payGradeId: string;
  name: string;
  currency: string;
  fullTimeHours: number;
  minAmount: number;
  midAmount: number;
  maxAmount: number;
  validFrom: string;
  validTo: string | null;
};

export function SalaryBandManageForm({ bands, payGrades }: { bands: SalaryBandRow[]; payGrades: Option[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(bands[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const selected = bands.find((band) => band.id === selectedId) ?? bands[0];

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true);
    setMessage(undefined);
    setError(undefined);
    try {
      await action();
      setMessage(success);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Aktion fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  if (!selected) {
    return (
      <FormPanel title="Gehaltsband bearbeiten" description="Bestehende Gehaltsbaender aendern oder loeschen.">
        <div className="text-sm text-ez-muted">Noch keine Gehaltsbaender vorhanden.</div>
      </FormPanel>
    );
  }

  return (
    <FormPanel title="Gehaltsband bearbeiten" description="Bestehende Gehaltsbaender aendern oder loeschen (mit Audit-Protokoll).">
      <div className="space-y-4">
        <Field label="Gehaltsband auswaehlen">
          <select className={inputClass} value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
            {bands.map((band) => (
              <option key={band.id} value={band.id}>{band.name}</option>
            ))}
          </select>
        </Field>
        <form
          key={selected.id}
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void run(async () => {
              await requestJson("/api/salary-bands", "PATCH", {
                id: selected.id,
                payGradeId: String(data.get("payGradeId")),
                name: String(data.get("name")),
                currency: String(data.get("currency") || "EUR"),
                fullTimeHours: Number(data.get("fullTimeHours") || 40),
                minAmount: moneyToCents(data.get("minAmount")),
                midAmount: moneyToCents(data.get("midAmount")),
                maxAmount: moneyToCents(data.get("maxAmount")),
                validFrom: isoDate(data.get("validFrom")),
                validTo: optional(data.get("validTo")) ? isoDate(data.get("validTo")) : null,
              });
            }, "Gehaltsband aktualisiert.");
          }}
        >
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Grade"><select className={inputClass} name="payGradeId" defaultValue={selected.payGradeId} required>{payGrades.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
            <Field label="Name"><input className={inputClass} name="name" defaultValue={selected.name} required /></Field>
            <Field label="Waehrung"><input className={inputClass} name="currency" defaultValue={selected.currency} minLength={3} maxLength={3} required /></Field>
            <Field label="Vollzeitstunden"><input className={inputClass} name="fullTimeHours" type="number" min="1" step="0.01" defaultValue={selected.fullTimeHours} required /></Field>
            <Field label="Min"><input className={inputClass} name="minAmount" inputMode="decimal" defaultValue={centsToInput(selected.minAmount)} required /></Field>
            <Field label="Mid"><input className={inputClass} name="midAmount" inputMode="decimal" defaultValue={centsToInput(selected.midAmount)} required /></Field>
            <Field label="Max"><input className={inputClass} name="maxAmount" inputMode="decimal" defaultValue={centsToInput(selected.maxAmount)} required /></Field>
            <Field label="Gueltig ab"><input className={inputClass} name="validFrom" type="date" defaultValue={selected.validFrom} required /></Field>
            <Field label="Gueltig bis"><input className={inputClass} name="validTo" type="date" defaultValue={selected.validTo ?? ""} /></Field>
          </div>
          <Result message={message} error={error} />
          <div className="flex flex-wrap gap-2">
            <SubmitButton icon={<Pencil size={16} />} label="Gehaltsband aktualisieren" busy={busy} />
            <DeleteButton
              label="Gehaltsband loeschen"
              busy={busy}
              onClick={() => {
                if (!window.confirm(`Gehaltsband "${selected.name}" loeschen?`)) return;
                void run(async () => {
                  await requestJson("/api/salary-bands", "DELETE", { id: selected.id });
                  setSelectedId("");
                }, "Gehaltsband geloescht.");
              }}
            />
          </div>
        </form>
      </div>
    </FormPanel>
  );
}

function ManagePanel<T extends { id: string }>({
  title,
  description,
  rows,
  optionLabel,
  selectedId,
  setSelectedId,
  message,
  error,
  children,
}: {
  title: string;
  description: string;
  rows: T[];
  optionLabel: (row: T) => string;
  selectedId: string;
  setSelectedId: (id: string) => void;
  message?: string;
  error?: string;
  children: ReactNode;
}) {
  if (!rows.length) {
    return (
      <FormPanel title={title} description={description}>
        <div className="text-sm text-ez-muted">Noch keine Eintraege vorhanden.</div>
      </FormPanel>
    );
  }
  return (
    <FormPanel title={title} description={description}>
      <div className="space-y-4">
        <Field label="Eintrag auswaehlen">
          <select className={inputClass} value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
            {rows.map((row) => (
              <option key={row.id} value={row.id}>{optionLabel(row)}</option>
            ))}
          </select>
        </Field>
        {children}
        <Result message={message} error={error} />
      </div>
    </FormPanel>
  );
}

function useManageState<T extends { id: string }>(rows: T[]) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(rows[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const selected = rows.find((row) => row.id === selectedId) ?? rows[0];
  async function run(action: () => Promise<void>, success: string) {
    setBusy(true);
    setMessage(undefined);
    setError(undefined);
    try {
      await action();
      setMessage(success);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Aktion fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }
  return { selectedId, setSelectedId, busy, message, error, selected, run };
}

const recruitmentStatuses = ["DRAFT", "APPROVED", "PUBLISHED", "CLOSED"] as const;
const remediationStatuses = ["OPEN", "IN_PROGRESS", "WAITING_FOR_APPROVAL", "COMPLETED", "CANCELLED"] as const;
const disclosureStatuses = ["RECEIVED", "IN_REVIEW", "WAITING_FOR_LEGAL", "READY", "ANSWERED", "OVERDUE", "CANCELLED"] as const;

type RecruitmentRow = {
  id: string;
  jobProfileId: string | null;
  title: string;
  location: string | null;
  salaryMinAmount: number;
  salaryMaxAmount: number;
  currency: string;
  payTransparencyText: string;
  genderNeutralCheck: boolean;
  priorPayQuestionBan: boolean;
  status: string;
};

export function RecruitmentManageForm({ postings, jobProfiles }: { postings: RecruitmentRow[]; jobProfiles: Option[] }) {
  const { selectedId, setSelectedId, busy, message, error, selected, run } = useManageState(postings);
  if (!selected) return <ManagePanel title="Ausschreibung bearbeiten" description="Bestehende Recruiting-Vorgaenge aendern oder loeschen." rows={postings} optionLabel={() => ""} selectedId="" setSelectedId={setSelectedId}><div /></ManagePanel>;
  return (
    <ManagePanel title="Ausschreibung bearbeiten" description="Bestehende Recruiting-Vorgaenge aendern oder loeschen." rows={postings} optionLabel={(row) => row.title} selectedId={selectedId} setSelectedId={setSelectedId} message={message} error={error}>
      <form
        key={selected.id}
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          void run(async () => {
            await requestJson("/api/recruitment", "PATCH", {
              id: selected.id,
              jobProfileId: optional(data.get("jobProfileId")) ?? null,
              title: String(data.get("title")),
              location: optional(data.get("location")) ?? null,
              salaryMinAmount: moneyToCents(data.get("salaryMinAmount")),
              salaryMaxAmount: moneyToCents(data.get("salaryMaxAmount")),
              currency: String(data.get("currency") || "EUR"),
              payTransparencyText: String(data.get("payTransparencyText")),
              genderNeutralCheck: data.get("genderNeutralCheck") === "on",
              priorPayQuestionBan: data.get("priorPayQuestionBan") === "on",
              status: String(data.get("status")),
            });
          }, "Ausschreibung aktualisiert.");
        }}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Stellenprofil"><select className={inputClass} name="jobProfileId" defaultValue={selected.jobProfileId ?? ""}><option value="">-</option>{jobProfiles.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
          <Field label="Titel"><input className={inputClass} name="title" defaultValue={selected.title} required /></Field>
          <Field label="Standort"><input className={inputClass} name="location" defaultValue={selected.location ?? ""} /></Field>
          <Field label="Waehrung"><input className={inputClass} name="currency" defaultValue={selected.currency} minLength={3} maxLength={3} required /></Field>
          <Field label="Gehalt min"><input className={inputClass} name="salaryMinAmount" inputMode="decimal" defaultValue={centsToInput(selected.salaryMinAmount)} required /></Field>
          <Field label="Gehalt max"><input className={inputClass} name="salaryMaxAmount" inputMode="decimal" defaultValue={centsToInput(selected.salaryMaxAmount)} required /></Field>
          <Field label="Status"><select className={inputClass} name="status" defaultValue={selected.status}>{recruitmentStatuses.map((item) => <option key={item}>{item}</option>)}</select></Field>
        </div>
        <Field label="Transparenztext"><textarea className={inputClass} name="payTransparencyText" rows={3} defaultValue={selected.payTransparencyText} required /></Field>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2"><input name="genderNeutralCheck" type="checkbox" defaultChecked={selected.genderNeutralCheck} /> geschlechtsneutral geprueft</label>
          <label className="flex items-center gap-2"><input name="priorPayQuestionBan" type="checkbox" defaultChecked={selected.priorPayQuestionBan} /> keine Frage nach Vorverguetung</label>
        </div>
        <div className="flex flex-wrap gap-2">
          <SubmitButton icon={<Pencil size={16} />} label="Ausschreibung aktualisieren" busy={busy} />
          <DeleteButton label="Ausschreibung loeschen" busy={busy} onClick={() => { if (!window.confirm(`Ausschreibung "${selected.title}" loeschen?`)) return; void run(async () => { await requestJson("/api/recruitment", "DELETE", { id: selected.id }); setSelectedId(""); }, "Ausschreibung geloescht."); }} />
        </div>
      </form>
    </ManagePanel>
  );
}

type RemediationRow = {
  id: string;
  payGapRowId: string | null;
  title: string;
  description: string;
  rootCause: string | null;
  objectiveReason: string | null;
  ownerUserId: string | null;
  dueAt: string;
  status: string;
};

export function RemediationManageForm({ actions, payGapRows, users }: { actions: RemediationRow[]; payGapRows: Option[]; users: UserOption[] }) {
  const { selectedId, setSelectedId, busy, message, error, selected, run } = useManageState(actions);
  if (!selected) return <ManagePanel title="Massnahme bearbeiten" description="Bestehende Massnahmen aendern oder loeschen." rows={actions} optionLabel={() => ""} selectedId="" setSelectedId={setSelectedId}><div /></ManagePanel>;
  return (
    <ManagePanel title="Massnahme bearbeiten" description="Bestehende Massnahmen aendern oder loeschen." rows={actions} optionLabel={(row) => row.title} selectedId={selectedId} setSelectedId={setSelectedId} message={message} error={error}>
      <form
        key={selected.id}
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          void run(async () => {
            await requestJson("/api/remediation", "PATCH", {
              id: selected.id,
              payGapRowId: optional(data.get("payGapRowId")) ?? null,
              title: String(data.get("title")),
              description: String(data.get("description")),
              rootCause: optional(data.get("rootCause")) ?? null,
              objectiveReason: optional(data.get("objectiveReason")) ?? null,
              ownerUserId: optional(data.get("ownerUserId")) ?? null,
              dueAt: isoDate(data.get("dueAt")),
              status: String(data.get("status")),
            });
          }, "Massnahme aktualisiert.");
        }}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Pay-Gap-Zeile"><select className={inputClass} name="payGapRowId" defaultValue={selected.payGapRowId ?? ""}><option value="">-</option>{payGapRows.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
          <Field label="Verantwortlich"><select className={inputClass} name="ownerUserId" defaultValue={selected.ownerUserId ?? ""}><option value="">-</option>{users.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.email}</option>)}</select></Field>
          <Field label="Titel"><input className={inputClass} name="title" defaultValue={selected.title} required /></Field>
          <Field label="Faellig bis"><input className={inputClass} name="dueAt" type="date" defaultValue={selected.dueAt} required /></Field>
          <Field label="Status"><select className={inputClass} name="status" defaultValue={selected.status}>{remediationStatuses.map((item) => <option key={item}>{item}</option>)}</select></Field>
        </div>
        <Field label="Beschreibung"><textarea className={inputClass} name="description" rows={2} defaultValue={selected.description} required /></Field>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Ursache"><textarea className={inputClass} name="rootCause" rows={2} defaultValue={selected.rootCause ?? ""} /></Field>
          <Field label="Objektiver Grund"><textarea className={inputClass} name="objectiveReason" rows={2} defaultValue={selected.objectiveReason ?? ""} /></Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <SubmitButton icon={<Pencil size={16} />} label="Massnahme aktualisieren" busy={busy} />
          <DeleteButton label="Massnahme loeschen" busy={busy} onClick={() => { if (!window.confirm(`Massnahme "${selected.title}" loeschen?`)) return; void run(async () => { await requestJson("/api/remediation", "DELETE", { id: selected.id }); setSelectedId(""); }, "Massnahme geloescht."); }} />
        </div>
      </form>
    </ManagePanel>
  );
}

type DocumentRow = { id: string; title: string; type: string; sensitivity: string };

export function DocumentManageForm({ documents }: { documents: DocumentRow[] }) {
  const { selectedId, setSelectedId, busy, message, error, selected, run } = useManageState(documents);
  if (!selected) return <ManagePanel title="Dokument bearbeiten" description="Metadaten aendern oder Dokument loeschen." rows={documents} optionLabel={() => ""} selectedId="" setSelectedId={setSelectedId}><div /></ManagePanel>;
  return (
    <ManagePanel title="Dokument bearbeiten" description="Titel, Typ und Sensitivitaet aendern oder Dokument loeschen." rows={documents} optionLabel={(row) => row.title} selectedId={selectedId} setSelectedId={setSelectedId} message={message} error={error}>
      <form
        key={selected.id}
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          void run(async () => {
            await requestJson("/api/documents", "PATCH", {
              id: selected.id,
              title: String(data.get("title")),
              type: String(data.get("type")),
              sensitivity: String(data.get("sensitivity")),
            });
          }, "Dokument aktualisiert.");
        }}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Titel"><input className={inputClass} name="title" defaultValue={selected.title} required /></Field>
          <Field label="Typ"><select className={inputClass} name="type" defaultValue={selected.type}>{documentTypes.map((item) => <option key={item}>{item}</option>)}</select></Field>
          <Field label="Sensitivitaet"><select className={inputClass} name="sensitivity" defaultValue={selected.sensitivity}>{sensitivities.map((item) => <option key={item}>{item}</option>)}</select></Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <SubmitButton icon={<Pencil size={16} />} label="Dokument aktualisieren" busy={busy} />
          <DeleteButton label="Dokument loeschen" busy={busy} onClick={() => { if (!window.confirm(`Dokument "${selected.title}" loeschen?`)) return; void run(async () => { await requestJson("/api/documents", "DELETE", { id: selected.id }); setSelectedId(""); }, "Dokument geloescht."); }} />
        </div>
      </form>
    </ManagePanel>
  );
}

type DisclosureRow = { id: string; requesterLabel: string; employeeId: string | null; comparisonGroup: string | null; notes: string | null; status: string; dueAt: string };

export function DisclosureManageForm({ requests, employees }: { requests: DisclosureRow[]; employees: Option[] }) {
  const { selectedId, setSelectedId, busy, message, error, selected, run } = useManageState(requests);
  if (!selected) return <ManagePanel title="Auskunftsersuchen bearbeiten" description="Status und Fristen aendern oder loeschen." rows={requests} optionLabel={() => ""} selectedId="" setSelectedId={setSelectedId}><div /></ManagePanel>;
  return (
    <ManagePanel title="Auskunftsersuchen bearbeiten" description="Status, Frist, Vergleichsgruppe und Notiz aendern oder loeschen." rows={requests} optionLabel={(row) => row.requesterLabel} selectedId={selectedId} setSelectedId={setSelectedId} message={message} error={error}>
      <form
        key={selected.id}
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          void run(async () => {
            await requestJson("/api/disclosure-requests", "PATCH", {
              id: selected.id,
              requesterLabel: String(data.get("requesterLabel")),
              employeeId: optional(data.get("employeeId")) ?? null,
              comparisonGroup: optional(data.get("comparisonGroup")) ?? null,
              notes: optional(data.get("notes")) ?? null,
              status: String(data.get("status")),
              dueAt: isoDate(data.get("dueAt")),
            });
          }, "Auskunftsersuchen aktualisiert.");
        }}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Anfragende Person"><input className={inputClass} name="requesterLabel" defaultValue={selected.requesterLabel} required /></Field>
          <Field label="Mitarbeiter"><select className={inputClass} name="employeeId" defaultValue={selected.employeeId ?? ""}><option value="">-</option>{employees.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
          <Field label="Vergleichsgruppe"><input className={inputClass} name="comparisonGroup" defaultValue={selected.comparisonGroup ?? ""} /></Field>
          <Field label="Faellig bis"><input className={inputClass} name="dueAt" type="date" defaultValue={selected.dueAt} required /></Field>
          <Field label="Status"><select className={inputClass} name="status" defaultValue={selected.status}>{disclosureStatuses.map((item) => <option key={item}>{item}</option>)}</select></Field>
        </div>
        <Field label="Notiz"><textarea className={inputClass} name="notes" rows={2} defaultValue={selected.notes ?? ""} /></Field>
        <div className="flex flex-wrap gap-2">
          <SubmitButton icon={<Pencil size={16} />} label="Auskunftsersuchen aktualisieren" busy={busy} />
          <DeleteButton label="Loeschen" busy={busy} onClick={() => { if (!window.confirm(`Auskunftsersuchen von "${selected.requesterLabel}" loeschen?`)) return; void run(async () => { await requestJson("/api/disclosure-requests", "DELETE", { id: selected.id }); setSelectedId(""); }, "Auskunftsersuchen geloescht."); }} />
        </div>
      </form>
    </ManagePanel>
  );
}

const reportStatuses = ["DRAFT", "GENERATED", "APPROVED", "SUBMITTED", "ARCHIVED"] as const;
const evaluationStatuses = ["DRAFT", "IN_REVIEW", "APPROVED", "ARCHIVED"] as const;

type CompensationRow = {
  id: string;
  label: string;
  type: string;
  compLabel: string;
  currency: string;
  validFrom: string;
  validTo: string | null;
  legalBasis: string;
  objectiveReason: string;
};

export function CompensationManageForm({ components }: { components: CompensationRow[] }) {
  const { selectedId, setSelectedId, busy, message, error, selected, run } = useManageState(components);
  if (!selected) return <ManagePanel title="Verguetung bearbeiten" description="Bestehende Verguetungsbestandteile aendern oder loeschen." rows={components} optionLabel={() => ""} selectedId="" setSelectedId={setSelectedId}><div /></ManagePanel>;
  return (
    <ManagePanel title="Verguetung bearbeiten" description="Bestehende Verguetungsbestandteile aendern oder loeschen. Der Betrag wird beim Speichern neu verschluesselt und erneut zur Freigabe gestellt." rows={components} optionLabel={(row) => row.label} selectedId={selectedId} setSelectedId={setSelectedId} message={message} error={error}>
      <form
        key={selected.id}
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          void run(async () => {
            await requestJson("/api/compensation", "PATCH", {
              id: selected.id,
              type: String(data.get("type")),
              label: String(data.get("label")),
              amountCents: moneyToCents(data.get("amount")),
              currency: String(data.get("currency") || "EUR"),
              validFrom: isoDate(data.get("validFrom")),
              validTo: optional(data.get("validTo")) ? isoDate(data.get("validTo")) : null,
              legalBasis: optional(data.get("legalBasis")) ?? null,
              objectiveReason: optional(data.get("objectiveReason")) ?? null,
            });
          }, "Verguetung aktualisiert.");
        }}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Art"><select className={inputClass} name="type" defaultValue={selected.type}>{compensationTypes.map((item) => <option key={item}>{item}</option>)}</select></Field>
          <Field label="Label"><input className={inputClass} name="label" defaultValue={selected.compLabel} required /></Field>
          <Field label="Neuer Betrag (Pflicht)"><input className={inputClass} name="amount" inputMode="decimal" placeholder="bisheriger Betrag ist verschluesselt" required /></Field>
          <Field label="Waehrung"><input className={inputClass} name="currency" defaultValue={selected.currency} minLength={3} maxLength={3} required /></Field>
          <Field label="Gueltig ab"><input className={inputClass} name="validFrom" type="date" defaultValue={selected.validFrom} required /></Field>
          <Field label="Gueltig bis"><input className={inputClass} name="validTo" type="date" defaultValue={selected.validTo ?? ""} /></Field>
          <Field label="Rechts-/Regelbasis"><input className={inputClass} name="legalBasis" defaultValue={selected.legalBasis} /></Field>
        </div>
        <Field label="Objektiver Grund"><textarea className={inputClass} name="objectiveReason" rows={2} defaultValue={selected.objectiveReason} /></Field>
        <div className="flex flex-wrap gap-2">
          <SubmitButton icon={<Pencil size={16} />} label="Verguetung aktualisieren" busy={busy} />
          <DeleteButton label="Verguetung loeschen" busy={busy} onClick={() => { if (!window.confirm(`Verguetungsbestandteil "${selected.label}" loeschen?`)) return; void run(async () => { await requestJson("/api/compensation", "DELETE", { id: selected.id }); setSelectedId(""); }, "Verguetung geloescht."); }} />
        </div>
      </form>
    </ManagePanel>
  );
}

type ReportRow = { id: string; name: string; status: string };

export function ReportManageForm({ reports }: { reports: ReportRow[] }) {
  const { selectedId, setSelectedId, busy, message, error, selected, run } = useManageState(reports);
  if (!selected) return <ManagePanel title="Report bearbeiten" description="Name/Status aendern oder Report loeschen." rows={reports} optionLabel={() => ""} selectedId="" setSelectedId={setSelectedId}><div /></ManagePanel>;
  return (
    <ManagePanel title="Report bearbeiten" description="Name und Status aendern oder Report loeschen (eingereichte Reports bleiben erhalten)." rows={reports} optionLabel={(row) => row.name} selectedId={selectedId} setSelectedId={setSelectedId} message={message} error={error}>
      <form
        key={selected.id}
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          void run(async () => {
            await requestJson("/api/reports", "PATCH", {
              id: selected.id,
              name: String(data.get("name")),
              status: String(data.get("status")),
            });
          }, "Report aktualisiert.");
        }}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Name"><input className={inputClass} name="name" defaultValue={selected.name} required /></Field>
          <Field label="Status"><select className={inputClass} name="status" defaultValue={selected.status}>{reportStatuses.map((item) => <option key={item}>{item}</option>)}</select></Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <SubmitButton icon={<Pencil size={16} />} label="Report aktualisieren" busy={busy} />
          <DeleteButton label="Report loeschen" busy={busy} onClick={() => { if (!window.confirm(`Report "${selected.name}" loeschen?`)) return; void run(async () => { await requestJson("/api/reports", "DELETE", { id: selected.id }); setSelectedId(""); }, "Report geloescht."); }} />
        </div>
      </form>
    </ManagePanel>
  );
}

type JobProfileRow = {
  id: string;
  label: string;
  title: string;
  code: string;
  status: string;
  jobFamilyId: string | null;
  comparisonGroupId: string | null;
  payGradeId: string | null;
  summary: string;
  responsibilities: string;
  requirements: string;
};

export function JobProfileManageForm({
  profiles,
  jobFamilies,
  comparisonGroups,
  payGrades,
}: {
  profiles: JobProfileRow[];
  jobFamilies: Option[];
  comparisonGroups: Option[];
  payGrades: Option[];
}) {
  const { selectedId, setSelectedId, busy, message, error, selected, run } = useManageState(profiles);
  if (!selected) return <ManagePanel title="Stellenprofil bearbeiten" description="Bestehende Stellenprofile aendern oder loeschen." rows={profiles} optionLabel={() => ""} selectedId="" setSelectedId={setSelectedId}><div /></ManagePanel>;
  return (
    <ManagePanel title="Stellenprofil bearbeiten" description="Stammdaten, Zuordnung und Status bestehender Stellenprofile aendern oder loeschen." rows={profiles} optionLabel={(row) => row.label} selectedId={selectedId} setSelectedId={setSelectedId} message={message} error={error}>
      <form
        key={selected.id}
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          void run(async () => {
            await requestJson("/api/job-profiles", "PATCH", {
              id: selected.id,
              title: String(data.get("title")),
              code: String(data.get("code")),
              jobFamilyId: optional(data.get("jobFamilyId")) ?? null,
              comparisonGroupId: optional(data.get("comparisonGroupId")) ?? null,
              payGradeId: optional(data.get("payGradeId")) ?? null,
              summary: optional(data.get("summary")) ?? null,
              responsibilities: optional(data.get("responsibilities")) ?? null,
              requirements: optional(data.get("requirements")) ?? null,
              status: String(data.get("status")),
            });
          }, "Stellenprofil aktualisiert.");
        }}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Rolle"><input className={inputClass} name="title" defaultValue={selected.title} required /></Field>
          <Field label="Code"><input className={inputClass} name="code" defaultValue={selected.code} required /></Field>
          <Field label="Jobfamilie"><select className={inputClass} name="jobFamilyId" defaultValue={selected.jobFamilyId ?? ""}><option value="">-</option>{jobFamilies.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
          <Field label="Vergleichsgruppe"><select className={inputClass} name="comparisonGroupId" defaultValue={selected.comparisonGroupId ?? ""}><option value="">-</option>{comparisonGroups.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
          <Field label="Grade"><select className={inputClass} name="payGradeId" defaultValue={selected.payGradeId ?? ""}><option value="">-</option>{payGrades.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
          <Field label="Status"><select className={inputClass} name="status" defaultValue={selected.status}>{evaluationStatuses.map((item) => <option key={item}>{item}</option>)}</select></Field>
        </div>
        <Field label="Kurzbeschreibung"><textarea className={inputClass} name="summary" rows={2} defaultValue={selected.summary} /></Field>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Aufgaben"><textarea className={inputClass} name="responsibilities" rows={3} defaultValue={selected.responsibilities} /></Field>
          <Field label="Anforderungen"><textarea className={inputClass} name="requirements" rows={3} defaultValue={selected.requirements} /></Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <SubmitButton icon={<Pencil size={16} />} label="Stellenprofil aktualisieren" busy={busy} />
          <DeleteButton label="Stellenprofil loeschen" busy={busy} onClick={() => { if (!window.confirm(`Stellenprofil "${selected.label}" loeschen?`)) return; void run(async () => { await requestJson("/api/job-profiles", "DELETE", { id: selected.id }); setSelectedId(""); }, "Stellenprofil geloescht."); }} />
        </div>
      </form>
    </ManagePanel>
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
