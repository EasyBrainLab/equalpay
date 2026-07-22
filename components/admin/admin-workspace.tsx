"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, AlertTriangle, BookOpenCheck, DatabaseZap, FileClock, KeyRound, LayoutDashboard, Pencil, Plus, Search, ShieldCheck, Trash2, UserCog, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type RoleKey = "SYSTEM_ADMIN" | "SECURITY_ADMIN" | "HR_ADMIN" | "HR_ANALYST" | "COMPENSATION_MANAGER" | "HR_VIEWER" | "LEGAL_REVIEWER" | "EMPLOYEE_REP_REVIEWER" | "MANAGER_CONTRIBUTOR" | "AUDITOR" | "IMPORT_OPERATOR";
type ManagedUser = { id: string; name: string; email: string; authProvider: "LOCAL" | "AZURE_AD"; azureObjectId: string | null; status: "ACTIVE" | "INVITED" | "DISABLED"; roles: RoleKey[]; lastLoginAt: string | null };
type OnboardingRow = { userId: string; name: string; email: string; roles: RoleKey[]; requiredModules: number; completedModules: number; percent: number; latestCompletion: string | null };
type RetentionPolicy = { id: string; entityType: string; retentionDays: number; action: "REVIEW" | "ANONYMIZE" | "DELETE" | "LEGAL_HOLD"; legalBasis: string; active: boolean };
type AuditRow = { id: string; action: string; severity: "INFO" | "WARNING" | "CRITICAL"; entityType: string | null; userEmail: string | null; createdAt: string };
type AdminWorkspaceProps = { currentUserId: string; canAdminUsers: boolean; canAdminRetention: boolean; users: ManagedUser[]; onboardingRows: OnboardingRow[]; retentionPolicies: RetentionPolicy[]; audits: AuditRow[] };

const roleOptions: RoleKey[] = ["SYSTEM_ADMIN", "SECURITY_ADMIN", "HR_ADMIN", "HR_ANALYST", "COMPENSATION_MANAGER", "HR_VIEWER", "LEGAL_REVIEWER", "EMPLOYEE_REP_REVIEWER", "MANAGER_CONTRIBUTOR", "AUDITOR", "IMPORT_OPERATOR"];
const roleDescriptions: Record<RoleKey, string> = {
  SYSTEM_ADMIN: "Technische Plattformverwaltung und Benutzeradministration.",
  SECURITY_ADMIN: "Sicherheits-, Retention- und Audit-Konfiguration.",
  HR_ADMIN: "HR-Fachadministration inklusive Benutzerverwaltung.",
  HR_ANALYST: "Analyse, Reporting und fachliche HR-Auswertungen.",
  COMPENSATION_MANAGER: "Verguetungsdaten, Gehaltsbaender und Pay-Gap-Analysen.",
  HR_VIEWER: "Lesender Zugriff auf fachliche HR-Informationen.",
  LEGAL_REVIEWER: "Juristische Pruefung von Auskunft, Reports und Dokumenten.",
  EMPLOYEE_REP_REVIEWER: "Review durch Arbeitnehmervertretung ohne Verguetungsbearbeitung.",
  MANAGER_CONTRIBUTOR: "Fachliche Zuarbeit zu Stellen und Mitarbeitenden.",
  AUDITOR: "Audit- und Nachweissicht ohne operative Bearbeitung.",
  IMPORT_OPERATOR: "Datenimporte fuer Mitarbeiter, Stellen und Dokumente.",
};

const inputClass = "w-full rounded border border-ez-line bg-white px-3 py-2 text-sm outline-none focus:border-ez-petrol";
const primaryButton = "focus-ring inline-flex items-center gap-2 rounded bg-ez-petrol px-3 py-2 text-sm font-semibold text-white hover:bg-ez-navy disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButton = "focus-ring inline-flex items-center gap-2 rounded border border-ez-line bg-white px-3 py-2 text-sm font-medium text-ez-navy hover:border-ez-petrol disabled:cursor-not-allowed disabled:opacity-60";
const dangerButton = "focus-ring inline-flex items-center gap-2 rounded border border-ez-burgundy-100 bg-white px-3 py-2 text-sm font-medium text-ez-burgundy-700 hover:bg-ez-burgundy-50 disabled:cursor-not-allowed disabled:opacity-60";

function formatDate(value: string | null) { return value ? new Date(value).toLocaleString("de-DE") : "-"; }
function roleTone(role: string): "neutral" | "warn" | "danger" { if (role === "SYSTEM_ADMIN" || role === "SECURITY_ADMIN") return "danger"; if (role === "HR_ADMIN" || role === "COMPENSATION_MANAGER") return "warn"; return "neutral"; }
function statusTone(status: string): "neutral" | "good" | "warn" | "danger" { if (status === "ACTIVE") return "good"; if (status === "DISABLED") return "danger"; return "warn"; }
function severityTone(severity: string): "neutral" | "warn" | "danger" { if (severity === "CRITICAL") return "danger"; if (severity === "WARNING") return "warn"; return "neutral"; }
function field(form: FormData, name: string) { return String(form.get(name) ?? "").trim(); }

async function requestJson(path: string, method: "POST" | "PATCH" | "DELETE", payload: unknown) {
  const response = await fetch(path, { method, credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) throw new Error("Nicht authentifiziert. Bitte erneut anmelden und dieselbe URL verwenden.");
  if (!response.ok) throw new Error(data.error ?? "Aktion fehlgeschlagen.");
  return data;
}

function PanelHeader({ title, description, icon }: { title: string; description: string; icon: React.ReactNode }) {
  return <div className="flex items-start gap-3 border-b border-ez-line px-4 py-3"><div className="rounded bg-ez-petrol-50 p-2 text-ez-petrol">{icon}</div><div><h2 className="font-semibold text-ez-navy">{title}</h2><p className="mt-1 text-sm leading-5 text-ez-muted">{description}</p></div></div>;
}

function Result({ message, error }: { message?: string; error?: string }) {
  if (!message && !error) return null;
  return <div className={`rounded px-3 py-2 text-sm ${error ? "bg-ez-burgundy-50 text-ez-burgundy-700" : "bg-emerald-50 text-emerald-700"}`}>{error ?? message}</div>;
}

function Metric({ label, value, hint, tone = "neutral" }: { label: string; value: number; hint: string; tone?: "neutral" | "good" | "warn" | "danger" }) {
  const borderClass = tone === "danger" ? "border-t-ez-burgundy" : tone === "warn" ? "border-t-amber-400" : tone === "good" ? "border-t-emerald-500" : "border-t-ez-petrol";
  return <div className={`rounded-md border border-t-4 border-ez-line ${borderClass} bg-white p-4`}><div className="text-2xl font-semibold text-ez-navy">{value}</div><div className="mt-1 text-sm font-medium text-ez-navy">{label}</div><div className="mt-1 text-xs leading-5 text-ez-muted">{hint}</div></div>;
}

type AdminTask = {
  id: string;
  title: string;
  summary: string;
  purpose: string;
  steps: string[];
  checks: string[];
  artifactTitle: string;
  artifactSections: [string, string][];
};

const adminTasks: AdminTask[] = [
  {
    id: "users",
    title: "Benutzer verwalten",
    summary: "Benutzer suchen, Stammdaten bearbeiten, Passwoerter zuruecksetzen und Accounts deaktivieren.",
    purpose: "Sicherstellen, dass nur berechtigte Personen Zugriff auf das Testsystem und spaeter auf produktive HR-Daten erhalten.",
    steps: ["Benutzer im Verzeichnis suchen oder ueber Filter eingrenzen.", "Datensatz auswaehlen und Stammdaten, Provider sowie Status pruefen.", "Bei lokalen Konten bei Bedarf ein neues Passwort setzen.", "Nicht mehr benoetigte Konten deaktivieren statt hart zu loeschen."],
    checks: ["Ist der Benutzer eindeutig identifiziert?", "Ist der Status ACTIVE nur fuer benoetigte Konten gesetzt?", "Wurde bei Passwort-Reset ein temporaeres Passwort sicher kommuniziert?"],
    artifactTitle: "Screenshot-Artefakt: Benutzerverzeichnis und Detailbereich",
    artifactSections: [["1", "Benutzer suchen und filtern"], ["2", "Datensatz rechts bearbeiten"], ["3", "Speichern, Reset oder Deaktivierung protokollieren"]],
  },
  {
    id: "roles",
    title: "Rollen pruefen",
    summary: "Zugriffe nach Need-to-know vergeben; kritische Rollen sind im Audit Trail nachvollziehbar.",
    purpose: "Rollen so vergeben, dass HR-Arbeit moeglich ist, ohne unnoetige Einsicht in sensible Verguetungs- oder Sicherheitsdaten zu schaffen.",
    steps: ["Benutzer auswaehlen und aktuelle Rollen lesen.", "Aufgabe des Benutzers mit der Rollenbeschreibung vergleichen.", "Nur erforderliche Rollen aktivieren.", "Kritische Rollen separat pruefen und nach der Aenderung im Audit Trail kontrollieren."],
    checks: ["Hat der Benutzer wirklich eine fachliche Aufgabe fuer diese Rolle?", "Sind SYSTEM_ADMIN und SECURITY_ADMIN getrennt?", "Ist HR_ADMIN bewusst vergeben und dokumentiert?"],
    artifactTitle: "Screenshot-Artefakt: Rollenmatrix mit kritischen Markierungen",
    artifactSections: [["A", "Rolle auswaehlen"], ["B", "Beschreibung lesen"], ["C", "Auditpflichtige Aenderung speichern"]],
  },
  {
    id: "onboarding",
    title: "Onboarding kontrollieren",
    summary: "Schulungsnachweise fuer sensible HR- und Verguetungsdaten pruefen.",
    purpose: "Nachweisen, dass Benutzer vor der Arbeit mit sensiblen Daten ausreichend eingewiesen wurden.",
    steps: ["Tab Onboarding oeffnen und offene Nachweise anzeigen.", "Benutzer mit weniger als 100 Prozent Abschluss identifizieren.", "Betroffene Benutzer zur In-App-Schulung auffordern.", "Nach Abschluss den neuesten Nachweis im Audit-Kontext pruefen."],
    checks: ["Sind alle aktiven HR- und Compensation-Benutzer geschult?", "Passt die Modulversion zur aktuellen Prozessversion?", "Sind offene Nachweise vor Kundendemonstrationen erklaert?"],
    artifactTitle: "Screenshot-Artefakt: Onboarding-Kontrollliste",
    artifactSections: [["1", "Offene Nachweise filtern"], ["2", "Modulfortschritt pruefen"], ["3", "Letzten Nachweis dokumentieren"]],
  },
  {
    id: "retention",
    title: "Retention steuern",
    summary: "Aufbewahrungs-, Review-, Anonymisierungs- und Legal-Hold-Regeln transparent verwalten.",
    purpose: "DSGVO- und Compliance-Anforderungen fuer Aufbewahrung und Loeschkonzepte nachvollziehbar operationalisieren.",
    steps: ["Retention-Tab oeffnen und aktive Regeln pruefen.", "Objekttyp, Frist, Aktion und Rechtsgrundlage lesen.", "Abweichungen zwischen HR-Anforderung und Regelwerk markieren.", "Aenderungen nur nach fachlicher und rechtlicher Freigabe umsetzen."],
    checks: ["Existiert fuer sensible Datentypen eine Regel?", "Ist die Rechtsgrundlage sprechend dokumentiert?", "Sind Legal-Hold-Faelle von Loeschregeln getrennt?"],
    artifactTitle: "Screenshot-Artefakt: Retention-Regelwerk",
    artifactSections: [["1", "Objekttyp"], ["2", "Frist und Aktion"], ["3", "Rechtsgrundlage"]],
  },
  {
    id: "audit",
    title: "Audit auswerten",
    summary: "Kritische administrative Aktionen und Sicherheitsereignisse zeitnah nachvollziehen.",
    purpose: "Sichtbar machen, wer wann sicherheits- oder compliance-relevante Aktionen ausgefuehrt hat.",
    steps: ["Audit-Tab oeffnen und nach Critical oder Warning filtern.", "Aktion, Zeitpunkt, Benutzer und Objekt pruefen.", "Unklare Ereignisse mit der verantwortlichen Person klaeren.", "Bei Bedarf zusaetzliche Nachweise im jeweiligen Fachbereich sichern."],
    checks: ["Gibt es ungeplante Rollen- oder Passwortaenderungen?", "Sind Deaktivierungen plausibel?", "Sind kritische Events zeitnah reviewed?"],
    artifactTitle: "Screenshot-Artefakt: Audit-Review",
    artifactSections: [["1", "Schweregrad filtern"], ["2", "Event lesen"], ["3", "Verantwortung klaeren"]],
  },
  {
    id: "azure",
    title: "Azure vorbereiten",
    summary: "Lokale Testnutzer verwenden und Azure Object IDs fuer SSO hinterlegen.",
    purpose: "Das Testsystem ohne Kunden-Azure betreiben und die spaetere Azure-Entra-ID-Anbindung fachlich vorbereiten.",
    steps: ["Im Testsystem LOCAL fuer Testnutzer verwenden.", "Fuer kuenftige SSO-Benutzer Provider AZURE_AD setzen.", "Azure Object ID hinterlegen, sobald sie vom Kunden bereitgestellt wird.", "Nach Azure-Aktivierung lokale Passwoerter fuer produktive Benutzer entfernen."],
    checks: ["Ist klar, ob der Benutzer lokal oder ueber Azure angemeldet wird?", "Liegt die korrekte Azure Object ID vor?", "Wurde MFA/SSO ausserhalb des Tools organisatorisch abgestimmt?"],
    artifactTitle: "Screenshot-Artefakt: Provider-Entscheidung",
    artifactSections: [["1", "LOCAL fuer Tests"], ["2", "AZURE_AD fuer Zielbetrieb"], ["3", "Object ID dokumentieren"]],
  },
];

function TaskArtifact({ task }: { task: AdminTask }) {
  return <div className="rounded-md border border-ez-line bg-ez-bg p-3"><div className="mb-3 text-sm font-semibold text-ez-navy">{task.artifactTitle}</div><div className="rounded border border-ez-line bg-white shadow-sm"><div className="flex items-center gap-2 border-b border-ez-line px-3 py-2"><span className="h-2.5 w-2.5 rounded-full bg-ez-burgundy-100" /><span className="h-2.5 w-2.5 rounded-full bg-amber-200" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-200" /><span className="ml-2 text-xs text-ez-muted">Administration / {task.title}</span></div><div className="grid gap-3 p-3 md:grid-cols-3">{task.artifactSections.map(([key, label]) => <div key={key} className="min-h-28 rounded border border-ez-line bg-white p-3"><div className="mb-3 inline-flex h-7 w-7 items-center justify-center rounded bg-ez-petrol text-xs font-bold text-white">{key}</div><div className="text-sm font-medium text-ez-navy">{label}</div><div className="mt-3 h-2 rounded bg-ez-petrol-50" /><div className="mt-2 h-2 w-2/3 rounded bg-ez-line" /><div className="mt-2 h-2 w-1/2 rounded bg-ez-line" /></div>)}</div></div><p className="mt-2 text-xs leading-5 text-ez-muted">Dieses eingebettete Artefakt bildet die erwartete Arbeitslogik im Tool ab und dient als visuelle Orientierung innerhalb der Admin-Konsole.</p></div>;
}

function TaskDetail({ task }: { task: AdminTask }) {
  return <section className="rounded-md border border-ez-line bg-white"><PanelHeader title={task.title} description={task.purpose} icon={<BookOpenCheck size={18} />} /><div className="grid gap-6 p-4 xl:grid-cols-[1fr_1fr]"><div className="space-y-4"><div><h3 className="text-sm font-semibold text-ez-navy">Arbeitsanweisung</h3><ol className="mt-2 list-decimal space-y-2 pl-5 text-sm leading-6 text-ez-muted">{task.steps.map((step) => <li key={step}>{step}</li>)}</ol></div><div><h3 className="text-sm font-semibold text-ez-navy">Pruefpunkte vor Abschluss</h3><ul className="mt-2 space-y-2 text-sm leading-6 text-ez-muted">{task.checks.map((check) => <li key={check} className="flex gap-2"><ShieldCheck className="mt-0.5 shrink-0 text-ez-petrol" size={15} /><span>{check}</span></li>)}</ul></div></div><TaskArtifact task={task} /></div></section>;
}

function AdminOverview({ users, onboardingRows, retentionPolicies, audits }: Pick<AdminWorkspaceProps, "users" | "onboardingRows" | "retentionPolicies" | "audits">) {
  const [selectedTaskId, setSelectedTaskId] = useState(adminTasks[0].id);
  const activeUsers = users.filter((user) => user.status === "ACTIVE").length;
  const disabledUsers = users.filter((user) => user.status === "DISABLED").length;
  const openOnboarding = onboardingRows.filter((row) => row.percent < 100).length;
  const criticalAudits = audits.filter((audit) => audit.severity === "CRITICAL").length;
  const activeRetention = retentionPolicies.filter((policy) => policy.active).length;
  const selectedTask = adminTasks.find((task) => task.id === selectedTaskId) ?? adminTasks[0];
  return <div className="space-y-6"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5"><Metric label="Aktive Benutzer" value={activeUsers} hint="Koennen sich anmelden und arbeiten." tone="good" /><Metric label="Deaktiviert" value={disabledUsers} hint="Login gesperrt; Nachweise bleiben erhalten." tone={disabledUsers ? "warn" : "neutral"} /><Metric label="Offenes Onboarding" value={openOnboarding} hint="Fehlende Schulungsnachweise." tone={openOnboarding ? "warn" : "good"} /><Metric label="Retention-Regeln" value={activeRetention} hint="Aktive Datenschutzregeln." /><Metric label="Kritische Audit-Events" value={criticalAudits} hint="Letzte protokollierte Events." tone={criticalAudits ? "danger" : "good"} /></div><section className="rounded-md border border-ez-line bg-white"><PanelHeader title="Administrative Aufgaben" description="Jede Kachel oeffnet eine konkrete Arbeitsanweisung mit Ablauf, Pruefpunkten und eingebettetem Orientierungsartefakt." icon={<LayoutDashboard size={18} />} /><div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">{adminTasks.map((task) => <button key={task.id} type="button" onClick={() => setSelectedTaskId(task.id)} className={`focus-ring rounded border p-4 text-left transition ${selectedTaskId === task.id ? "border-ez-petrol bg-ez-petrol-50" : "border-ez-line bg-white hover:border-ez-petrol"}`}><div className="flex items-start justify-between gap-3"><div className="font-semibold text-ez-navy">{task.title}</div><span className="rounded bg-ez-bg px-2 py-0.5 text-xs font-semibold text-ez-muted">Details</span></div><p className="mt-1 text-sm leading-5 text-ez-muted">{task.summary}</p></button>)}</div></section><TaskDetail task={selectedTask} /></div>;
}


function UserCreatePanel({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState<string>(); const [error, setError] = useState<string>();
  return <section className="rounded-md border border-ez-line bg-white"><PanelHeader title="Benutzer anlegen" description="Lege lokale Testnutzer an oder bereite Azure/Entra-ID-Benutzer vor." icon={<Plus size={18} />} /><form className="space-y-4 p-4" onSubmit={async (event) => { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); setBusy(true); setMessage(undefined); setError(undefined); try { await requestJson("/api/admin/users", "POST", { email: field(data, "email"), name: field(data, "name"), authProvider: field(data, "authProvider"), azureObjectId: field(data, "azureObjectId") || undefined, password: field(data, "password") || undefined, role: field(data, "role") || undefined }); form.reset(); setMessage("Benutzer angelegt oder aktualisiert."); onDone(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Benutzer konnte nicht gespeichert werden."); } finally { setBusy(false); } }}><div className="grid gap-3 md:grid-cols-2"><label className="block text-sm font-medium text-ez-navy">Name<input className={`${inputClass} mt-1`} name="name" required /></label><label className="block text-sm font-medium text-ez-navy">E-Mail<input className={`${inputClass} mt-1`} name="email" type="email" required /></label><label className="block text-sm font-medium text-ez-navy">Provider<select className={`${inputClass} mt-1`} name="authProvider" defaultValue="LOCAL"><option value="LOCAL">LOCAL</option><option value="AZURE_AD">AZURE_AD</option></select></label><label className="block text-sm font-medium text-ez-navy">Initiale Rolle<select className={`${inputClass} mt-1`} name="role"><option value="">Keine Rolle</option>{roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}</select></label><label className="block text-sm font-medium text-ez-navy">Azure Object ID<input className={`${inputClass} mt-1`} name="azureObjectId" /></label><label className="block text-sm font-medium text-ez-navy">Startpasswort<input className={`${inputClass} mt-1`} name="password" type="password" minLength={12} autoComplete="new-password" /></label></div><Result message={message} error={error} /><button className={primaryButton} disabled={busy} type="submit"><Plus size={16} />{busy ? "Speichern..." : "Benutzer anlegen"}</button></form></section>;
}

function UserDetailPanel({ user, currentUserId, onDone }: { user: ManagedUser; currentUserId: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState<string>(); const [error, setError] = useState<string>();
  async function run(action: () => Promise<void>, success: string) { setBusy(true); setMessage(undefined); setError(undefined); try { await action(); setMessage(success); onDone(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Aktion fehlgeschlagen."); } finally { setBusy(false); } }
  return <section className="rounded-md border border-ez-line bg-white"><PanelHeader title="Benutzerdetails bearbeiten" description="Bearbeite Stammdaten, Provider, Status, Rollen und lokale Passwoerter fuer den ausgewaehlten Benutzer." icon={<UserCog size={18} />} /><form key={user.id} className="space-y-4 p-4" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void run(async () => { await requestJson("/api/admin/users", "PATCH", { userId: user.id, name: field(data, "name"), email: field(data, "email"), authProvider: field(data, "authProvider"), azureObjectId: field(data, "azureObjectId") || undefined, status: field(data, "status"), roles: roleOptions.filter((role) => data.get(`role:${role}`) === "on") }); }, "Benutzer aktualisiert."); }}><div className="grid gap-3 md:grid-cols-2"><label className="block text-sm font-medium text-ez-navy">Name<input className={`${inputClass} mt-1`} name="name" defaultValue={user.name} required /></label><label className="block text-sm font-medium text-ez-navy">E-Mail<input className={`${inputClass} mt-1`} name="email" type="email" defaultValue={user.email} required /></label><label className="block text-sm font-medium text-ez-navy">Provider<select className={`${inputClass} mt-1`} name="authProvider" defaultValue={user.authProvider}><option value="LOCAL">LOCAL</option><option value="AZURE_AD">AZURE_AD</option></select></label><label className="block text-sm font-medium text-ez-navy">Status<select className={`${inputClass} mt-1`} name="status" defaultValue={user.status}><option value="ACTIVE">ACTIVE</option><option value="INVITED">INVITED</option><option value="DISABLED">DISABLED</option></select></label><label className="block text-sm font-medium text-ez-navy md:col-span-2">Azure Object ID<input className={`${inputClass} mt-1`} name="azureObjectId" defaultValue={user.azureObjectId ?? ""} /></label></div><div><div className="text-sm font-semibold text-ez-navy">Rollen und Zugriffe</div><p className="mt-1 text-xs leading-5 text-ez-muted">Vergib nur Rollen, die fuer die Aufgabe erforderlich sind. Kritische Rollen werden deutlich markiert.</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{roleOptions.map((role) => <label key={role} className="rounded border border-ez-line px-3 py-2 text-sm"><span className="flex items-center gap-2 font-medium text-ez-navy"><input name={`role:${role}`} type="checkbox" defaultChecked={user.roles.includes(role)} />{role}</span><span className="mt-1 block text-xs leading-4 text-ez-muted">{roleDescriptions[role]}</span></label>)}</div></div><div className="rounded border border-ez-line bg-ez-bg p-3"><label className="block text-sm font-medium text-ez-navy">Neues Passwort fuer lokalen Reset<input className={`${inputClass} mt-1`} name="resetPassword" type="password" minLength={12} autoComplete="new-password" disabled={user.authProvider !== "LOCAL"} /></label><p className="mt-1 text-xs leading-5 text-ez-muted">Azure/Entra-ID-Passwoerter werden nicht in dieser Anwendung verwaltet.</p></div><Result message={message} error={error} /><div className="flex flex-wrap gap-2"><button className={primaryButton} disabled={busy} type="submit"><Pencil size={16} />{busy ? "Speichern..." : "Benutzer aktualisieren"}</button><button type="button" disabled={busy || user.authProvider !== "LOCAL"} className={secondaryButton} onClick={(event) => { const form = event.currentTarget.form; const input = form?.elements.namedItem("resetPassword"); const password = input instanceof HTMLInputElement ? input.value : ""; if (!password) { setError("Bitte zuerst ein neues Passwort eingeben."); setMessage(undefined); return; } void run(async () => { await requestJson("/api/admin/users", "PATCH", { action: "resetPassword", userId: user.id, password }); if (input instanceof HTMLInputElement) input.value = ""; }, "Passwort zurueckgesetzt und aktive Sessions geloescht."); }}><KeyRound size={16} />Passwort zuruecksetzen</button><button type="button" disabled={busy || user.id === currentUserId || user.status === "DISABLED"} className={dangerButton} onClick={() => { if (!window.confirm(`Benutzer ${user.email} deaktivieren? Der Login wird gesperrt und aktive Sessions werden geloescht.`)) return; void run(async () => { await requestJson("/api/admin/users", "DELETE", { userId: user.id }); }, "Benutzer deaktiviert."); }}><Trash2 size={16} />Benutzer deaktivieren</button></div></form></section>;
}

function UsersTab({ users, currentUserId, onDone }: { users: ManagedUser[]; currentUserId: string; onDone: () => void }) {
  const [query, setQuery] = useState(""); const [status, setStatus] = useState("ALL"); const [role, setRole] = useState("ALL"); const [selectedId, setSelectedId] = useState(users[0]?.id ?? "");
  const filtered = useMemo(() => { const needle = query.trim().toLowerCase(); return users.filter((user) => { const matchesQuery = !needle || `${user.name} ${user.email}`.toLowerCase().includes(needle); const matchesStatus = status === "ALL" || user.status === status; const matchesRole = role === "ALL" || user.roles.includes(role as RoleKey); return matchesQuery && matchesStatus && matchesRole; }); }, [query, role, status, users]);
  const selected = users.find((user) => user.id === selectedId) ?? filtered[0] ?? users[0];
  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(420px,0.9fr)]"><section className="rounded-md border border-ez-line bg-white"><PanelHeader title="Benutzerverzeichnis" description="Suche, filtere und waehle Benutzer aus. Die Bearbeitung erfolgt im Detailbereich." icon={<Users size={18} />} /><div className="grid gap-3 border-b border-ez-line p-4 md:grid-cols-[1fr_180px_220px]"><label className="relative block"><Search className="pointer-events-none absolute left-3 top-2.5 text-ez-muted" size={16} /><input className={`${inputClass} pl-9`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name oder E-Mail suchen" /></label><select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Statusfilter"><option value="ALL">Alle Status</option><option value="ACTIVE">Aktiv</option><option value="INVITED">Eingeladen</option><option value="DISABLED">Deaktiviert</option></select><select className={inputClass} value={role} onChange={(event) => setRole(event.target.value)} aria-label="Rollenfilter"><option value="ALL">Alle Rollen</option>{roleOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-ez-bg text-xs uppercase text-ez-muted"><tr><th className="px-3 py-2">Benutzer</th><th className="px-3 py-2">Provider</th><th className="px-3 py-2">Rollen</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Letzter Login</th></tr></thead><tbody>{filtered.map((user) => <tr key={user.id} className={`cursor-pointer border-t border-ez-line hover:bg-ez-petrol-50/60 ${selected?.id === user.id ? "bg-ez-petrol-50" : ""}`} onClick={() => setSelectedId(user.id)}><td className="px-3 py-2"><div className="font-medium text-ez-navy">{user.name}</div><div className="text-xs text-ez-muted">{user.email}</div></td><td className="px-3 py-2">{user.authProvider}</td><td className="px-3 py-2"><div className="flex max-w-sm flex-wrap gap-1">{user.roles.length ? user.roles.map((item) => <Badge key={item} tone={roleTone(item)}>{item}</Badge>) : <span className="text-ez-muted">Keine Rolle</span>}</div></td><td className="px-3 py-2"><Badge tone={statusTone(user.status)}>{user.status}</Badge></td><td className="px-3 py-2 text-ez-muted">{formatDate(user.lastLoginAt)}</td></tr>)}{!filtered.length && <tr><td className="px-3 py-6 text-center text-ez-muted" colSpan={5}>Keine Benutzer fuer die gewaehlten Filter.</td></tr>}</tbody></table></div></section><div className="space-y-6">{selected && <UserDetailPanel user={selected} currentUserId={currentUserId} onDone={onDone} />}<UserCreatePanel onDone={onDone} /></div></div>;
}

function OnboardingTab({ rows }: { rows: OnboardingRow[] }) {
  const [filter, setFilter] = useState("OPEN"); const visible = rows.filter((row) => filter === "ALL" || (filter === "OPEN" ? row.percent < 100 : row.percent === 100));
  return <section className="rounded-md border border-ez-line bg-white"><PanelHeader title="Onboarding-Nachweise" description="Kontrolliere, ob Benutzer fuer den Umgang mit sensiblen HR- und Verguetungsdaten geschult wurden." icon={<BookOpenCheck size={18} />} /><div className="border-b border-ez-line p-4"><select className={`${inputClass} max-w-xs`} value={filter} onChange={(event) => setFilter(event.target.value)}><option value="OPEN">Nur offene Nachweise</option><option value="DONE">Vollstaendig abgeschlossen</option><option value="ALL">Alle Benutzer</option></select></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-ez-bg text-xs uppercase text-ez-muted"><tr><th className="px-3 py-2">Benutzer</th><th className="px-3 py-2">Rollen</th><th className="px-3 py-2">Module</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Letzter Nachweis</th></tr></thead><tbody>{visible.map((row) => <tr key={row.userId} className="border-t border-ez-line"><td className="px-3 py-2"><div className="font-medium text-ez-navy">{row.name}</div><div className="text-xs text-ez-muted">{row.email}</div></td><td className="px-3 py-2"><div className="flex flex-wrap gap-1">{row.roles.map((item) => <Badge key={item} tone={roleTone(item)}>{item}</Badge>)}</div></td><td className="px-3 py-2">{row.completedModules} / {row.requiredModules}</td><td className="px-3 py-2"><Badge tone={row.percent === 100 ? "good" : row.percent === 0 ? "danger" : "warn"}>{row.percent}%</Badge></td><td className="px-3 py-2 text-ez-muted">{formatDate(row.latestCompletion)}</td></tr>)}</tbody></table></div></section>;
}

function RetentionTab({ policies }: { policies: RetentionPolicy[] }) {
  return <section className="rounded-md border border-ez-line bg-white"><PanelHeader title="Retention und Datenschutz" description="Aufbewahrung, Anonymisierung, Loeschung und Legal Hold fuer Compliance-Daten nachvollziehen." icon={<FileClock size={18} />} /><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-ez-bg text-xs uppercase text-ez-muted"><tr><th className="px-3 py-2">Objekt</th><th className="px-3 py-2">Aufbewahrung</th><th className="px-3 py-2">Aktion</th><th className="px-3 py-2">Rechtsgrundlage</th><th className="px-3 py-2">Status</th></tr></thead><tbody>{policies.map((policy) => <tr key={policy.id} className="border-t border-ez-line"><td className="px-3 py-2 font-medium text-ez-navy">{policy.entityType}</td><td className="px-3 py-2">{policy.retentionDays} Tage</td><td className="px-3 py-2">{policy.action}</td><td className="px-3 py-2 text-ez-muted">{policy.legalBasis}</td><td className="px-3 py-2"><Badge tone={policy.active ? "good" : "neutral"}>{policy.active ? "aktiv" : "inaktiv"}</Badge></td></tr>)}</tbody></table></div></section>;
}

function AuditTab({ audits }: { audits: AuditRow[] }) {
  const [severity, setSeverity] = useState("ALL"); const visible = audits.filter((audit) => severity === "ALL" || audit.severity === severity);
  return <section className="rounded-md border border-ez-line bg-white"><PanelHeader title="Audit Trail" description="Protokollierte administrative Aktionen, Login-Vorgaenge und sicherheitsrelevante Systemereignisse." icon={<Activity size={18} />} /><div className="border-b border-ez-line p-4"><select className={`${inputClass} max-w-xs`} value={severity} onChange={(event) => setSeverity(event.target.value)}><option value="ALL">Alle Schweregrade</option><option value="CRITICAL">Critical</option><option value="WARNING">Warning</option><option value="INFO">Info</option></select></div><div className="divide-y divide-ez-line">{visible.map((audit) => <div key={audit.id} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[1fr_160px_220px] md:items-center"><div><div className="font-medium text-ez-navy">{audit.action}</div><div className="mt-1 text-xs text-ez-muted">{audit.entityType ?? "-"}</div></div><Badge tone={severityTone(audit.severity)}>{audit.severity}</Badge><div className="text-xs text-ez-muted md:text-right">{formatDate(audit.createdAt)}<br />{audit.userEmail ?? "system"}</div></div>)}</div></section>;
}

export function AdminWorkspace(props: AdminWorkspaceProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "onboarding" | "retention" | "audit">("overview");
  const tabs = [
    { id: "overview" as const, label: "Uebersicht", icon: LayoutDashboard, enabled: true },
    { id: "users" as const, label: "Benutzer", icon: Users, enabled: props.canAdminUsers },
    { id: "onboarding" as const, label: "Onboarding", icon: BookOpenCheck, enabled: true },
    { id: "retention" as const, label: "Retention", icon: DatabaseZap, enabled: props.canAdminRetention },
    { id: "audit" as const, label: "Audit", icon: ShieldCheck, enabled: true },
  ];
  return <main className="space-y-6 p-6"><section className="rounded-md border border-ez-line bg-white"><div className="flex items-start gap-3 border-b border-ez-line px-4 py-3"><div className="rounded bg-ez-petrol-50 p-2 text-ez-petrol"><AlertTriangle size={18} /></div><div><h2 className="font-semibold text-ez-navy">Admin-Arbeitsbereich</h2><p className="mt-1 max-w-4xl text-sm leading-6 text-ez-muted">Die Administration ist nach Aufgaben getrennt. Kritische Aktionen wie Rollenwechsel, Passwort-Reset und Benutzerdeaktivierung werden protokolliert.</p></div></div><div className="flex flex-wrap gap-2 p-3">{tabs.filter((tab) => tab.enabled).map((tab) => { const Icon = tab.icon; const selected = activeTab === tab.id; return <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`focus-ring inline-flex items-center gap-2 rounded px-3 py-2 text-sm font-semibold ${selected ? "bg-ez-petrol text-white" : "bg-ez-bg text-ez-navy hover:bg-ez-petrol-50"}`}><Icon size={16} />{tab.label}</button>; })}</div></section>{activeTab === "overview" && <AdminOverview users={props.users} onboardingRows={props.onboardingRows} retentionPolicies={props.retentionPolicies} audits={props.audits} />}{activeTab === "users" && props.canAdminUsers && <UsersTab users={props.users} currentUserId={props.currentUserId} onDone={() => router.refresh()} />}{activeTab === "onboarding" && <OnboardingTab rows={props.onboardingRows} />}{activeTab === "retention" && props.canAdminRetention && <RetentionTab policies={props.retentionPolicies} />}{activeTab === "audit" && <AuditTab audits={props.audits} />}</main>;
}
