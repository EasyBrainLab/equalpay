import type { RoleKey } from "@prisma/client";

export type OnboardingModuleSeed = {
  key: string;
  version: number;
  title: string;
  objective: string;
  content: string;
  estimatedMinutes: number;
  sortOrder: number;
  applicableRoles: RoleKey[];
};

export const ONBOARDING_ATTESTATION =
  "Ich bestaetige, dass ich dieses Schulungsmodul gelesen und verstanden habe und die beschriebenen Regeln beim Umgang mit der Pay-Transparency-Anwendung und sensiblen Daten einhalte.";

export const DEFAULT_ONBOARDING_MODULES: OnboardingModuleSeed[] = [
  {
    key: "legal-purpose",
    version: 1,
    title: "Zweck und rechtlicher Rahmen",
    objective: "Verstehen, warum das Tool fuer Entgelttransparenz, Nachweisfaehigkeit und faire Verguetung eingesetzt wird.",
    content:
      "Die Anwendung unterstuetzt HR dabei, gleiche oder gleichwertige Arbeit nachvollziehbar und diskriminierungsfrei zu bewerten. Relevante Grundlagen sind die EU-Entgelttransparenz-Richtlinie (EU) 2023/970, das erwartete deutsche Umsetzungsgesetz, interne Verguetungsregeln und Datenschutzvorgaben. Jede fachliche Entscheidung muss objektiv begruendet und dokumentiert werden.",
    estimatedMinutes: 6,
    sortOrder: 10,
    applicableRoles: [],
  },
  {
    key: "security-privacy",
    version: 1,
    title: "Datenschutz und Sicherheitsregeln",
    objective: "Sicheren Umgang mit Personen-, Stellen- und Verguetungsdaten im Tagesgeschaeft beherrschen.",
    content:
      "Verguetungsdaten sind besonders schutzbeduerftig. Benutzer duerfen Daten nur fuer ihren konkreten Arbeitsauftrag verwenden. Keine Screenshots, Downloads oder Exporte ohne Zweck und Berechtigung. Rollen sind eng zu vergeben. Systemadministration bedeutet technische Verwaltung, nicht fachlichen Klartextzugriff auf Pay-Daten. Verdachtsfaelle, Fehlzugriffe oder falsche Berechtigungen sind sofort an HR/Security zu melden.",
    estimatedMinutes: 8,
    sortOrder: 20,
    applicableRoles: [],
  },
  {
    key: "master-data-quality",
    version: 1,
    title: "Mitarbeitende, Stellen und Gehaltsbaender pflegen",
    objective: "Datenqualitaet als Grundlage fuer rechtssichere Auswertungen sicherstellen.",
    content:
      "Mitarbeiterdaten, Jobprofile, Jobfamilien, Vergleichsgruppen, Grades und Gehaltsbaender muessen konsistent gepflegt werden. Unklare oder fehlende Zuordnungen koennen Pay-Gap-Analysen verfaelschen. Stellenbewertungen muessen auf objektiven Kriterien wie Kompetenz, Verantwortung, Belastung und Arbeitsbedingungen beruhen. Alte Regelungen sind historisch nachvollziehbar zu halten und nicht unkontrolliert zu ueberschreiben.",
    estimatedMinutes: 8,
    sortOrder: 30,
    applicableRoles: ["HR_ADMIN", "COMPENSATION_MANAGER", "HR_ANALYST", "IMPORT_OPERATOR"],
  },
  {
    key: "pay-data-analysis",
    version: 1,
    title: "Verguetungsdaten und Pay-Gap-Analysen",
    objective: "Pay-Daten korrekt erfassen, auswerten und Abweichungen sachlich begruenden.",
    content:
      "Verguetungsbestandteile werden nur mit Rechts- oder Regelbasis, Gueltigkeit und objektivem Grund erfasst. Pay-Gap-Auswertungen sind fachlich zu pruefen: Vergleichsgruppen, Grade, FTE, Arbeitszeit und variable Bestandteile koennen das Ergebnis beeinflussen. Relevante Abweichungen muessen dokumentiert, begruendet oder in Massnahmen ueberfuehrt werden. Klartextzugriff auf Pay-Daten ist streng rollenbasiert.",
    estimatedMinutes: 9,
    sortOrder: 40,
    applicableRoles: ["HR_ADMIN", "COMPENSATION_MANAGER", "HR_ANALYST", "LEGAL_REVIEWER", "AUDITOR"],
  },
  {
    key: "disclosure-reporting",
    version: 1,
    title: "Auskunft, Reports und Dokumentation",
    objective: "Auskunftsersuchen, Reports und Dokumente nachvollziehbar bearbeiten.",
    content:
      "Auskunftsersuchen sind fristgerecht zu erfassen, fachlich zu bearbeiten und rechtlich zu pruefen. Reports und Exporte muessen zweckgebunden erzeugt, geprueft und mit Checksumme beziehungsweise Audit-Nachweis abgelegt werden. Dokumente wie Policies, Betriebsvereinbarungen, Legal Memos und Templates sind mit Sensitivitaet, Status und Gueltigkeit zu pflegen.",
    estimatedMinutes: 7,
    sortOrder: 50,
    applicableRoles: ["HR_ADMIN", "LEGAL_REVIEWER", "AUDITOR", "EMPLOYEE_REP_REVIEWER", "HR_VIEWER"],
  },
  {
    key: "ai-job-assistant",
    version: 1,
    title: "KI Job Architecture Assistant",
    objective: "Entwurfscharakter, Review-Pflicht und Grenzen des KI-Assistenten verstehen.",
    content:
      "Der KI Job Architecture Assistant ist als sicherer Entwurfsprozess angelegt. Er ersetzt keine fachliche Entscheidung. Hochgeladene Stellenbeschreibungen werden lokal extrahiert und als Draft analysiert. Vorschlaege zu Jobfamilie, Vergleichsgruppe, Kriterienpunkten und Grade muessen durch HR geprueft werden. Transfer in die Jobarchitektur ist nur nach Human Review zulaessig.",
    estimatedMinutes: 6,
    sortOrder: 60,
    applicableRoles: ["HR_ADMIN", "COMPENSATION_MANAGER"],
  },
  {
    key: "audit-behavior",
    version: 1,
    title: "Audit-Verhalten und Nachweisfuehrung",
    objective: "Verstehen, welche Aktionen dokumentiert werden und wie ein Audit vorbereitet wird.",
    content:
      "Kritische Aktionen wie Rollenvergabe, Entschluesselung, Import, Report-Download, Stellenuebernahme und Schulungsabschluss erzeugen Audit-Events. Benutzer muessen fachliche Gruende in den vorgesehenen Feldern dokumentieren und duerfen keine informellen Nebenakten fuehren. Fuer Audits zaehlen konsistente Daten, vollstaendige Schulungsnachweise, nachvollziehbare Rollen und ein plausibler Entscheidungsverlauf.",
    estimatedMinutes: 6,
    sortOrder: 70,
    applicableRoles: [],
  },
];
