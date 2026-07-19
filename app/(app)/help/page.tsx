import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { requireAuth } from "@/lib/auth/session";
import {
  AlertTriangle,
  BookOpen,
  BrainCircuit,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardList,
  Database,
  FileSpreadsheet,
  KeyRound,
  Landmark,
  LockKeyhole,
  Scale,
  ShieldCheck,
  Timer,
  Users,
} from "lucide-react";

const chapters = [
  { href: "#purpose", label: "Zweck" },
  { href: "#roles", label: "Rollen" },
  { href: "#processes", label: "Prozesse" },
  { href: "#legal", label: "Pflichten" },
  { href: "#security", label: "Sicherheit" },
  { href: "#operations", label: "Betrieb" },
  { href: "#checklists", label: "Checklisten" },
];

const roleRows = [
  ["HR_ADMIN", "Fachliche Gesamtpflege", "Mitarbeitende, Stellen, Verguetung, Reports, Auskunft, Dokumente"],
  ["COMPENSATION_MANAGER", "Verguetung und Analysen", "Gehaltsbaender, Verguetungsbestandteile, Pay-Gap, Remediation"],
  ["HR_ANALYST", "Auswertung", "Analytics und Reports lesen bzw. Dry-Runs vorbereiten"],
  ["LEGAL_REVIEWER", "Rechtliche Pruefung", "Auskunftsantworten, Dokumente, Reports pruefen"],
  ["AUDITOR", "Kontrolle", "Audit Trail, Reports und Nachweise lesen"],
  ["SYSTEM_ADMIN", "Technischer Betrieb", "Benutzer/Rollen administrieren, kein Pay-Klartextzugriff"],
  ["SECURITY_ADMIN", "Security/Retention", "Retention Policies, Security-nahe Kontrollen, kein HR-Fachzugriff"],
  ["IMPORT_OPERATOR", "Datenuebernahme", "Mitarbeitenden- und Pay-Daten importieren, keine Entschluesselung"],
];

const workflows = [
  {
    id: "ai-job-assistant",
    icon: BrainCircuit,
    title: "Stellenbeschreibung per KI-Assist entwerfen",
    route: "/job-architecture/ai-assistant",
    steps: [
      "Stellenbeschreibung hochladen und Business Unit/Gesellschaft angeben.",
      "Lokale Extraktion und PII-Redaktion pruefen.",
      "Vorschlag fuer Jobfamilie, Vergleichsgruppe, Kriterienpunkte und Grade bewerten.",
      "Missing-Info und Bias-Warnungen fachlich klaeren.",
      "Erst nach Human Review in die Jobarchitektur uebernehmen.",
    ],
    evidence: "Quelldatei-Hash, extrahierter verschluesselter Text, Prompt-Version, Prompt-Hash, Vorschlag, Evidenz, Review-Notiz, Transfer-Audit.",
  },
  {
    id: "job",
    icon: Scale,
    title: "Stelle bewerten",
    route: "/job-architecture",
    steps: [
      "Stellenprofil mit Code, Titel, Jobfamilie und Vergleichsgruppe anlegen.",
      "Kriterien Kompetenz, Verantwortung, Belastung und Arbeitsbedingungen bewerten.",
      "Automatisch abgeleiteten Grade pruefen.",
      "Bewertung fachlich freigeben und als Grundlage fuer Gehaltsband verwenden.",
    ],
    evidence: "Stellenprofil, Punktewert, Kriterienbewertung, Grade, Vergleichsgruppe, Audit-Event.",
  },
  {
    id: "salary-band",
    icon: Landmark,
    title: "Gehaltsband pflegen",
    route: "/pay-bands",
    steps: [
      "Grade auswaehlen.",
      "Bandname, Waehrung, Vollzeitbasis und Min/Mid/Max erfassen.",
      "Gueltig-ab-Datum setzen.",
      "Alte Baender nicht loeschen, sondern historisch abgrenzen.",
    ],
    evidence: "Gehaltsband, Gueltigkeit, Grade-Bezug, Audit-Event.",
  },
  {
    id: "compensation",
    icon: LockKeyhole,
    title: "Verguetung erfassen",
    route: "/compensation",
    steps: [
      "Mitarbeitenden auswaehlen.",
      "Verguetungsart und Betrag erfassen.",
      "Rechts-/Regelbasis und objektiven Grund dokumentieren.",
      "Daten werden serverseitig verschluesselt und nur berechtigten Rollen angezeigt.",
    ],
    evidence: "Verschluesselter Betrag, Last-4-Merkmal, objektiver Grund, Approval-Status, Audit-Event.",
  },
  {
    id: "pay-gap",
    icon: FileSpreadsheet,
    title: "Pay-Gap-Dry-Run",
    route: "/pay-gap",
    steps: [
      "Verguetungs- und Stellenzuordnung pruefen.",
      "Dry-Run starten.",
      "Gruppen mit 5-Prozent-Trigger bewerten.",
      "Objektive Gruende dokumentieren oder Massnahmen anlegen.",
    ],
    evidence: "Aggregierte Pay-Gap-Zeilen, Durchschnitt, Median, Triggerstatus, keine persistierten Klartextgehaelter.",
  },
  {
    id: "remediation",
    icon: Timer,
    title: "Abhilfemassnahme steuern",
    route: "/remediation",
    steps: [
      "Pay-Gap-Zeile auswaehlen.",
      "Ursache und objektiven Grund erfassen.",
      "Verantwortliche Person und Frist setzen.",
      "Massnahme bis Abschluss nachverfolgen.",
    ],
    evidence: "Massnahme, Ursache, Frist, Status, Verantwortlicher, Audit-Event.",
  },
  {
    id: "disclosure",
    icon: ClipboardList,
    title: "Auskunft beantworten",
    route: "/disclosures",
    steps: [
      "Auskunftsvorgang mit requesterLabel und Mitarbeitendenbezug erfassen.",
      "Frist ueberwachen.",
      "Antwortakte generieren.",
      "Legal-/DSGVO-Pruefung durchfuehren und Antwort dokumentieren.",
    ],
    evidence: "Auskunftsvorgang, Due Date, Antwortakte, Vergleichsgruppenwerte, Legal-Review-Status.",
  },
  {
    id: "reporting",
    icon: BookOpen,
    title: "Art.-9-Report erzeugen",
    route: "/reports",
    steps: [
      "Berichtsperiode setzen.",
      "Report generieren.",
      "Checksumme dokumentieren.",
      "CSV exportieren und nach Freigabe ablegen oder einreichen.",
    ],
    evidence: "ComplianceReport, verschluesselter CSV-Export, SHA-256-Checksumme, Download-Audit.",
  },
  {
    id: "recruiting",
    icon: BriefcaseBusiness,
    title: "Recruiting-Transparenz",
    route: "/recruitment",
    steps: [
      "Posting mit Stellenprofil und Standort erfassen.",
      "Gehaltsspanne und Transparenztext hinterlegen.",
      "Gender-Neutral-Check bestaetigen.",
      "Verbot der Frage nach Vorverguetung dokumentieren.",
    ],
    evidence: "RecruitmentPosting, Gehaltsspanne, Transparenztext, Pflichtchecks, Status.",
  },
];

const legalRows = [
  ["Art. 5", "Bewerbungsprozess", "Einstiegsentgelt oder Gehaltsspanne, keine Frage nach bisheriger Verguetung, geschlechtsneutrale Ausschreibung.", "Recruiting"],
  ["Art. 6", "Entgeltkriterien", "Objektive, geschlechtsneutrale Kriterien fuer Entgelt und Entwicklung.", "Jobarchitektur, Gehaltsbaender"],
  ["Art. 7", "Auskunftsanspruch", "Individuelles Entgelt und Durchschnittswerte vergleichbarer Beschaeftigter, nach Geschlecht aufgeschluesselt.", "Auskunft"],
  ["Art. 9", "Reporting", "Gender-Pay-Gap-Kennzahlen, variable Verguetung, Quartile und Kategorien.", "Reports"],
  ["Art. 10", "Gemeinsame Bewertung", "5-Prozent-Trigger ohne objektive Begruendung muss nachverfolgt und behoben werden.", "Pay-Gap, Massnahmen"],
  ["DSGVO", "Datenschutz", "Zweckbindung, Datenminimierung, Integritaet, Vertraulichkeit, Aufbewahrung.", "Security, Retention, Audit"],
];

const securityRules = [
  "Systemadmins erhalten keinen fachlichen Pay-Klartextzugriff.",
  "Pay-Daten werden mit AES-256-GCM feldverschluesselt.",
  "Entschluesselungen, Downloads und kritische Schreibaktionen erzeugen Audit-Events.",
  "Produktiv muss der Master Key in Azure Key Vault Managed HSM oder einem gleichwertigen KMS liegen.",
  "Produktiv muessen Entra ID, MFA, Conditional Access und getrennte Admin-Rollen aktiviert werden.",
  "CSV-Importe muessen vor Produktivnutzung fachlich kontrolliert und in Testumgebungen validiert werden.",
  "Auskunftsantworten duerfen erst nach Legal-/DSB-Freigabe herausgegeben werden.",
  "Retention Policies definieren Review, Anonymisierung, Loeschung oder Legal Hold je Objekttyp.",
];

const operatingChecks = [
  ["Taeglich", "Compliance-Dashboard pruefen, offene Auskunftsvorgaenge und ueberfaellige Massnahmen kontrollieren."],
  ["Woechentlich", "Neue oder geaenderte Verguetungsdaten auf objektive Gruende und Approval-Status pruefen."],
  ["Monatlich", "Pay-Gap-Dry-Run durchfuehren und Trigger mit Massnahmen verknuepfen."],
  ["Quartalsweise", "Gehaltsbaender, Retention Policies, Rollenvergabe und Audit Trail pruefen."],
  ["Jaehrlich", "Art.-9-Report erzeugen, freigeben, archivieren und externe Meldepflichten pruefen."],
];

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6">
      <h2 className="text-lg font-semibold text-ez-navy">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function StepList({ items }: { items: string[] }) {
  return (
    <ol className="space-y-1 text-sm text-ez-muted">
      {items.map((item, index) => (
        <li key={item} className="flex gap-2">
          <span className="font-semibold text-ez-petrol">{index + 1}.</span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}

export default async function HelpPage() {
  await requireAuth();

  return (
    <>
      <PageHeader title="Handbuch" description="In-App-Hilfe fuer Betrieb, HR-Fachprozesse, Compliance-Nachweise und Sicherheitsrollen." />
      <main className="grid gap-6 p-6 xl:grid-cols-[260px_1fr]">
        <aside className="h-fit rounded-md border border-ez-line bg-white p-4">
          <div className="flex items-center gap-2 font-semibold text-ez-navy">
            <BookOpen size={18} />
            Kapitel
          </div>
          <nav className="mt-3 space-y-1">
            {chapters.map((chapter) => (
              <a key={chapter.href} href={chapter.href} className="block rounded px-2 py-1.5 text-sm text-ez-muted hover:bg-ez-petrol-50 hover:text-ez-petrol">
                {chapter.label}
              </a>
            ))}
          </nav>
          <div className="mt-4 rounded bg-ez-petrol-50 p-3 text-xs text-ez-muted">
            Stand: Richtlinie (EU) 2023/970 und DSGVO technisch abgebildet. Nationale deutsche Detailregeln muessen nach Inkrafttreten abgeglichen werden.
          </div>
        </aside>

        <div className="space-y-8">
          <Section id="purpose" title="1. Zweck der Anwendung">
            <div className="rounded-md border border-ez-line bg-white p-4 text-sm leading-6 text-ez-muted">
              Die Anwendung dient als zentrale Nachweisplattform fuer Entgelttransparenz. Sie verbindet Stellenbewertung, Vergleichsgruppen,
              Gehaltsbaender, verschluesselte Verguetungsdaten, Pay-Gap-Analysen, Auskunftsvorgaenge, Recruiting-Transparenz, Reports,
              Dokumente, Remediation und Audit Trail. Ziel ist, dass HR objektiv belegen kann, warum gleiche oder gleichwertige Arbeit gleich
              bezahlt wird oder welche sachlichen Gruende eine Abweichung rechtfertigen.
            </div>
          </Section>

          <Section id="roles" title="2. Rollen und Zugriffe">
            <div className="overflow-hidden rounded-md border border-ez-line bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-ez-bg text-xs uppercase text-ez-muted">
                  <tr>
                    <th className="px-3 py-2">Rolle</th>
                    <th className="px-3 py-2">Zweck</th>
                    <th className="px-3 py-2">Typische Rechte</th>
                  </tr>
                </thead>
                <tbody>
                  {roleRows.map(([role, purpose, rights]) => (
                    <tr key={role} className="border-t border-ez-line align-top">
                      <td className="px-3 py-2"><Badge tone={role.includes("ADMIN") ? "warn" : "neutral"}>{role}</Badge></td>
                      <td className="px-3 py-2 font-medium">{purpose}</td>
                      <td className="px-3 py-2 text-ez-muted">{rights}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="processes" title="3. Fachliche Arbeitsablaeufe">
            <div className="grid gap-4 lg:grid-cols-2">
              {workflows.map((workflow) => (
                <article key={workflow.id} className="rounded-md border border-ez-line bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-ez-navy">{workflow.title}</h3>
                      <a href={workflow.route} className="text-xs text-ez-petrol underline">{workflow.route}</a>
                    </div>
                    <div className="rounded bg-ez-petrol-50 p-2 text-ez-petrol">
                      <workflow.icon size={18} />
                    </div>
                  </div>
                  <div className="mt-3">
                    <StepList items={workflow.steps} />
                  </div>
                  <div className="mt-3 rounded bg-ez-bg p-3 text-xs text-ez-muted">
                    Nachweis: {workflow.evidence}
                  </div>
                </article>
              ))}
            </div>
          </Section>

          <Section id="legal" title="4. Rechtliche Mindestanforderungen">
            <div className="overflow-hidden rounded-md border border-ez-line bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-ez-bg text-xs uppercase text-ez-muted">
                  <tr>
                    <th className="px-3 py-2">Quelle</th>
                    <th className="px-3 py-2">Thema</th>
                    <th className="px-3 py-2">Mindestanforderung</th>
                    <th className="px-3 py-2">Modul</th>
                  </tr>
                </thead>
                <tbody>
                  {legalRows.map(([source, topic, requirement, module]) => (
                    <tr key={`${source}-${topic}`} className="border-t border-ez-line align-top">
                      <td className="px-3 py-2 font-semibold">{source}</td>
                      <td className="px-3 py-2">{topic}</td>
                      <td className="px-3 py-2 text-ez-muted">{requirement}</td>
                      <td className="px-3 py-2">{module}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="security" title="5. Sicherheit und Datenschutz">
            <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
              <div className="rounded-md border border-ez-line bg-white p-4">
                <div className="flex items-center gap-2 font-semibold text-ez-navy">
                  <ShieldCheck size={18} />
                  Schutzprinzipien
                </div>
                <ul className="mt-3 space-y-2 text-sm text-ez-muted">
                  {securityRules.map((rule) => (
                    <li key={rule} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 shrink-0 text-ez-petrol" size={15} />
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-md border border-ez-line bg-white p-4">
                <div className="flex items-center gap-2 font-semibold text-ez-navy">
                  <KeyRound size={18} />
                  Produktivpflicht
                </div>
                <p className="mt-3 text-sm leading-6 text-ez-muted">
                  Lokale Entwicklung nutzt einen Entwicklungs-Key. Fuer Produktion muessen Entra ID, MFA, Azure Key Vault Managed HSM,
                  getrennte Adminrollen, Secret Rotation, Backup-Verschluesselung, DSFA und TOM-Dokumentation verbindlich aktiviert sein.
                </p>
                <div className="mt-3 rounded bg-ez-burgundy-50 p-3 text-sm text-ez-burgundy-700">
                  Kein Produktivbetrieb mit lokalen Secrets oder ohne KMS/HSM-Freigabe.
                </div>
              </div>
            </div>
          </Section>

          <Section id="operations" title="6. Betrieb und Regelkontrollen">
            <div className="overflow-hidden rounded-md border border-ez-line bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-ez-bg text-xs uppercase text-ez-muted">
                  <tr>
                    <th className="px-3 py-2">Takt</th>
                    <th className="px-3 py-2">Kontrolle</th>
                  </tr>
                </thead>
                <tbody>
                  {operatingChecks.map(([cadence, check]) => (
                    <tr key={cadence} className="border-t border-ez-line">
                      <td className="px-3 py-2 font-semibold">{cadence}</td>
                      <td className="px-3 py-2 text-ez-muted">{check}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="checklists" title="7. Produktiv-Checklisten">
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-md border border-ez-line bg-white p-4">
                <div className="flex items-center gap-2 font-semibold text-ez-navy"><Database size={18} /> Datenqualitaet</div>
                <StepList items={[
                  "Alle aktiven Mitarbeitenden haben Stellenprofil und Grade.",
                  "Alle Stellen haben Punktebewertung und Vergleichsgruppe.",
                  "Alle Verguetungsabweichungen haben objektiven Grund.",
                  "Importfehler sind bereinigt.",
                ]} />
              </div>
              <div className="rounded-md border border-ez-line bg-white p-4">
                <div className="flex items-center gap-2 font-semibold text-ez-navy"><Users size={18} /> Governance</div>
                <StepList items={[
                  "Rollenmatrix durch HR, IT, Legal und DSB freigegeben.",
                  "Betriebsratliche Beteiligung geklaert.",
                  "Legal Review fuer Auskunftsantworten definiert.",
                  "Reporting-Verantwortliche benannt.",
                ]} />
              </div>
              <div className="rounded-md border border-ez-line bg-white p-4">
                <div className="flex items-center gap-2 font-semibold text-ez-navy"><AlertTriangle size={18} /> Go-live Sperren</div>
                <StepList items={[
                  "Kein lokaler Field-Encryption-Key in Produktion.",
                  "Keine produktive Nutzung ohne Entra ID/MFA.",
                  "Keine Reportabgabe ohne Legal-Freigabe.",
                  "Keine Auskunftsausgabe ohne Datenschutzpruefung.",
                ]} />
              </div>
            </div>
          </Section>
        </div>
      </main>
    </>
  );
}
