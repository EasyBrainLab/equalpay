# EZ Pay Transparency HR Suite

MVP fuer ein internes Entgelttransparenz- und Compensation-Governance-System fuer HR.
Die Anwendung ist als Next.js/Prisma/PostgreSQL-App aufgebaut und orientiert sich an der bestehenden lokalen APPS-Architektur.

## Funktionsumfang

- Mandanten-, Gesellschafts-, Segment-, Standort- und Abteilungsstruktur
- Rollen- und Berechtigungsmodell fuer HR, Compensation, Audit, Security und Systemadministration
- Mitarbeitendenstamm mit Pseudonym und Stellen-/Grade-Zuordnung
- Jobarchitektur mit Jobfamilien, Stellenprofilen, Vergleichsgruppen und objektiver Bewertung
- KI Job Architecture Assistant als sicherer Entwurfsprozess ohne externe KI-Anbindung
- Upload und lokale Textauswertung von Stellenbeschreibungen mit Prompt-Versionierung, PII-Redaktion, Evidenz, Unsicherheiten und Human Review
- Gehaltsbaender je Grade mit Min/Mid/Max
- Verschluesselte Verguetungsbestandteile
- Pay-Gap-Dry-Run mit 5-Prozent-Trigger und aggregierter Ergebnisablage
- Auskunftsersuchen mit Fristenstatus
- Auskunftsantworten mit individueller Verguetung, Vergleichsgruppenwerten und Legal-Review-Status
- Dokumentenregister fuer Richtlinien, Betriebsvereinbarungen, Gutachten und Templates
- Art.-9-Reportgenerierung als verschluesselter CSV-Export mit SHA-256-Checksumme
- Compliance-Kontrollzentrum fuer Datenqualitaet, Fristen, Retention, Recruiting und Remediation
- Abhilfemassnahmen fuer Pay-Gap-Trigger mit Ursache, Verantwortlichem, Frist und Status
- Recruiting-Transparenzakten mit Gehaltsspanne, Transparenztext, Gender-Neutral-Check und Verbot der Vorverguetungsfrage
- Retention Policies fuer Aufbewahrung, Review, Anonymisierung, Loeschung und Legal Hold
- CSV-Import fuer Mitarbeitendenstammdaten
- Audit-Logging fuer kritische Lese-, Entschluesselungs- und Schreibzugriffe
- Azure/Entra-ID-Adapter als produktionsnahe Auth-Abstraktion ohne Kunden-Azure-Zugriff

## Lokaler Start

```bash
npm install
pg_ctl -D .pgdata -l pg.log -o "-p 5438" start
npx prisma migrate dev
npm run db:seed
npm run dev
```

App: `http://localhost:3000`

Demo-Login:

```text
hr.admin@example.local
ChangeMe-Entgelt-2026

system.admin@example.local
ChangeMe-System-2026

security.admin@example.local
ChangeMe-Security-2026
```

## Wichtige Umgebungsvariablen

Siehe `.env.example`.

- `DATABASE_URL`: PostgreSQL-Verbindung
- `SESSION_SECRET`: zufaelliger Produktionswert, mindestens 32 Zeichen
- `FIELD_ENCRYPTION_MASTER_KEY_B64`: 32-Byte-Key als Base64; in Produktion nicht lokal speichern
- `AUTH_PROVIDER`: `local` fuer Entwicklung, `azure-ad` fuer Entra ID
- `AZURE_AD_TENANT_ID`, `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_REDIRECT_URI`: Entra-ID-Parameter

## Sicherheitsmodell

Die Anwendung trennt technische Administration und HR-Fachdaten auf Anwendungsebene:

- `SYSTEM_ADMIN` darf Struktur und Audit sehen, aber keine Pay-Entschluesselung ausfuehren.
- `HR_ADMIN` und `COMPENSATION_MANAGER` duerfen bei Bedarf Pay-Daten entschluesseln.
- Verguetungsbetraege werden mit AES-256-GCM verschluesselt.
- Entschluesselungen werden als Warning-Audit-Events protokolliert.
- Pay-Gap-Analysen entschluesseln nur im Backend und speichern aggregierte Ergebnisse.

Fuer den produktiven Betrieb reicht lokale Feldverschluesselung nicht aus, wenn Server- oder Datenbankadmins die Laufzeitumgebung vollstaendig kontrollieren. Erforderlich ist dann:

- Schluesselhaltung in Azure Key Vault Managed HSM oder vergleichbarem KMS/HSM
- Kein Key-Export an Systemadministratoren
- Managed Identity oder Workload Identity fuer die Anwendung
- RBAC/PIM und Vier-Augen-Freigaben fuer Key-Operationen
- getrennte Rollen fuer Betrieb, Security und HR
- minimale Break-Glass-Prozesse mit Protokollierung
- DSFA, AVV, TOMs und Loesch-/Aufbewahrungskonzept vor Produktivstart

Damit ist technisch erreichbar, dass ein Systemadmin Datenbank, Server und Deployments betreibt, aber keine Gehaltsdaten entschluesseln kann. Absolute Abschirmung ist nur moeglich, wenn Admins keinen Zugriff auf KMS/HSM-Schluessel, Secrets, produktive Shells und Live-Memory der Anwendung erhalten.

## Compliance-Abdeckung

Die Anwendung bildet die wesentlichen Pflichten aus der EU-Entgelttransparenzrichtlinie technisch ab:

- Art. 5: Recruiting-Transparenz durch dokumentierte Gehaltsspannen und Verbot der Vorverguetungsfrage
- Art. 6: Entgeltkriterien durch Jobarchitektur, objektive Bewertungskriterien, Grades und Gehaltsbaender
- Art. 6-Vorbereitung: vorhandene Stellenbeschreibungen koennen als Entwurf analysiert und erst nach HR-Review in die Jobarchitektur uebernommen werden
- Art. 7: Auskunftsanspruch durch Auskunftsvorgaenge, Fristen und generierbare Antwortakten
- Art. 9: Reporting durch verschluesselte CSV-Reports mit Durchschnitts-/Medianwerten, variabler Verguetung, Kategorien und Quartilen
- Art. 10: 5-Prozent-Trigger durch Pay-Gap-Analyse und Remediation-Massnahmen
- Beweisvorsorge: Audit-Trail, Versionierung, objektive Gruende, Checksumme und Freigabestatus
- DSGVO/TOM: Rollenmodell, Need-to-know, Feldverschluesselung, Audit, Retention Policies und Datenminimierung

Rechtlich final wird die Anwendung erst nach:

- Freigabe durch Legal, Datenschutzbeauftragte und Betriebsrat
- Abgleich mit dem deutschen Umsetzungsgesetz, sobald der ressortabgestimmte Entwurf bzw. das Gesetz vorliegt
- produktiver Entra-ID-/MFA-Anbindung
- produktiver KMS/HSM-Schluesselhaltung
- DSFA, TOM-Dokumentation, Berechtigungsmatrix und Betriebskonzept

## Qualitaetspruefung

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm audit --audit-level=moderate
```

Bekanntes Thema: `npm audit` meldet aktuell eine moderate transitive `postcss`-Schwachstelle ueber Next.js. `npm audit fix --force` wuerde Next.js auf eine alte Hauptversion downgraden und darf nicht verwendet werden. Dieses Thema muss ueber ein kompatibles Next.js-/PostCSS-Update geloest werden, sobald verfuegbar.
