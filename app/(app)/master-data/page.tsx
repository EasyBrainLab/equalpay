import { PageHeader } from "@/components/layout/page-header";
import { MasterDataTabs, type MasterTab } from "@/components/data/master-data-tabs";
import type { ColumnDef, FieldDef } from "@/components/data/record-manager";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/session";
import { hasPermission } from "@/lib/security/permissions";

const str = (value: unknown) => (value === null || value === undefined ? "" : String(value));

export default async function MasterDataPage() {
  const ctx = await requireAuth();
  const canOrg = hasPermission(ctx.roles, "org:edit");
  const canJob = hasPermission(ctx.roles, "job:edit");
  const where = { tenantId: ctx.tenantId };

  const [companies, segments, sites, departments, jobFamilies, payGrades, comparisonGroups, criteria] = await Promise.all([
    prisma.company.findMany({ where, orderBy: { name: "asc" } }),
    prisma.segment.findMany({ where, include: { company: true }, orderBy: { name: "asc" } }),
    prisma.site.findMany({ where, include: { company: true }, orderBy: { name: "asc" } }),
    prisma.department.findMany({ where, include: { company: true }, orderBy: { name: "asc" } }),
    prisma.jobFamily.findMany({ where, orderBy: { name: "asc" } }),
    prisma.payGrade.findMany({ where, orderBy: { sortOrder: "asc" } }),
    prisma.comparisonGroup.findMany({ where, orderBy: { name: "asc" } }),
    prisma.evaluationCriterion.findMany({ where, orderBy: { sortOrder: "asc" } }),
  ]);

  const companyOptions = companies.map((item) => ({ id: item.id, label: `${item.name} (${item.code})` }));
  const nameCode: ColumnDef[] = [{ key: "name", header: "Name" }, { key: "code", header: "Code" }];
  const companyField: FieldDef = { name: "companyId", label: "Gesellschaft", kind: "select", options: companyOptions };

  const orgTabs: MasterTab[] = [
    {
      key: "companies", label: "Gesellschaften", title: "Gesellschaften", description: "Rechtseinheiten des Mandanten.",
      endpoint: "/api/master-data/companies",
      rows: companies.map((item) => ({ id: item.id, name: item.name, code: item.code, country: item.country })),
      columns: [...nameCode, { key: "country", header: "Land" }],
      fields: [{ name: "name", label: "Name" }, { name: "code", label: "Code" }, { name: "country", label: "Land (ISO-2)" }],
      searchKeys: ["name", "code"], canEdit: canOrg, newLabel: "Gesellschaft", deleteConfirm: "Gesellschaft „{name}“ löschen?",
    },
    {
      key: "segments", label: "Segmente", title: "Segmente", description: "Geschäftssegmente (optional einer Gesellschaft zugeordnet).",
      endpoint: "/api/master-data/segments",
      rows: segments.map((item) => ({ id: item.id, name: item.name, code: item.code, companyId: item.companyId, companyName: item.company?.name ?? "-" })),
      columns: [...nameCode, { key: "companyName", header: "Gesellschaft" }],
      fields: [{ name: "name", label: "Name" }, { name: "code", label: "Code" }, { ...companyField, optional: true }],
      searchKeys: ["name", "code"], canEdit: canOrg, newLabel: "Segment", deleteConfirm: "Segment „{name}“ löschen?",
    },
    {
      key: "sites", label: "Standorte", title: "Standorte", description: "Standorte je Gesellschaft.",
      endpoint: "/api/master-data/sites",
      rows: sites.map((item) => ({ id: item.id, name: item.name, code: item.code, companyId: item.companyId, companyName: item.company?.name ?? "-" })),
      columns: [...nameCode, { key: "companyName", header: "Gesellschaft" }],
      fields: [{ name: "name", label: "Name" }, { name: "code", label: "Code" }, companyField],
      searchKeys: ["name", "code"], canEdit: canOrg, newLabel: "Standort", deleteConfirm: "Standort „{name}“ löschen?",
    },
    {
      key: "departments", label: "Abteilungen", title: "Abteilungen", description: "Abteilungen je Gesellschaft.",
      endpoint: "/api/master-data/departments",
      rows: departments.map((item) => ({ id: item.id, name: item.name, code: item.code, companyId: item.companyId, companyName: item.company?.name ?? "-" })),
      columns: [...nameCode, { key: "companyName", header: "Gesellschaft" }],
      fields: [{ name: "name", label: "Name" }, { name: "code", label: "Code" }, companyField],
      searchKeys: ["name", "code"], canEdit: canOrg, newLabel: "Abteilung", deleteConfirm: "Abteilung „{name}“ löschen?",
    },
  ];

  const jobTabs: MasterTab[] = [
    {
      key: "job-families", label: "Jobfamilien", title: "Jobfamilien", description: "Fachliche Gruppierung von Stellenprofilen.",
      endpoint: "/api/master-data/job-families",
      rows: jobFamilies.map((item) => ({ id: item.id, name: item.name, code: item.code, description: str(item.description) })),
      columns: [...nameCode, { key: "description", header: "Beschreibung" }],
      fields: [{ name: "name", label: "Name" }, { name: "code", label: "Code" }, { name: "description", label: "Beschreibung", optional: true }],
      searchKeys: ["name", "code"], canEdit: canJob, newLabel: "Jobfamilie", deleteConfirm: "Jobfamilie „{name}“ löschen?",
    },
    {
      key: "pay-grades", label: "Grades", title: "Grades", description: "Bewertungs-Grades (Punktekorridor, Sortierung).",
      endpoint: "/api/master-data/pay-grades",
      rows: payGrades.map((item) => ({ id: item.id, code: item.code, name: item.name, minPoints: item.minPoints, maxPoints: item.maxPoints, sortOrder: item.sortOrder, description: str(item.description) })),
      columns: [{ key: "code", header: "Code" }, { key: "name", header: "Name" }, { key: "minPoints", header: "Min" }, { key: "maxPoints", header: "Max" }, { key: "sortOrder", header: "Sort" }],
      fields: [
        { name: "code", label: "Code" }, { name: "name", label: "Name" },
        { name: "minPoints", label: "Min. Punkte", kind: "number" }, { name: "maxPoints", label: "Max. Punkte", kind: "number" },
        { name: "sortOrder", label: "Sortierung", kind: "number" }, { name: "description", label: "Beschreibung", optional: true },
      ],
      searchKeys: ["code", "name"], canEdit: canJob, newLabel: "Grade", deleteConfirm: "Grade „{code}“ löschen?",
    },
    {
      key: "comparison-groups", label: "Vergleichsgruppen", title: "Vergleichsgruppen", description: "Gruppen für Auskunft/Pay-Gap-Vergleiche.",
      endpoint: "/api/master-data/comparison-groups",
      rows: comparisonGroups.map((item) => ({ id: item.id, code: item.code, name: item.name, description: str(item.description) })),
      columns: [{ key: "code", header: "Code" }, { key: "name", header: "Name" }, { key: "description", header: "Beschreibung" }],
      fields: [{ name: "code", label: "Code" }, { name: "name", label: "Name" }, { name: "description", label: "Beschreibung", optional: true }],
      searchKeys: ["code", "name"], canEdit: canJob, newLabel: "Vergleichsgruppe", deleteConfirm: "Vergleichsgruppe „{name}“ löschen?",
    },
    {
      key: "evaluation-criteria", label: "Bewertungskriterien", title: "Bewertungskriterien", description: "Gewichtete Kriterien der Stellenbewertung.",
      endpoint: "/api/master-data/evaluation-criteria",
      rows: criteria.map((item) => ({ id: item.id, key: item.key, name: item.name, weight: item.weight, sortOrder: item.sortOrder, description: str(item.description) })),
      columns: [{ key: "key", header: "Schlüssel", kind: "code" }, { key: "name", header: "Name" }, { key: "weight", header: "Gewicht %" }, { key: "sortOrder", header: "Sort" }],
      fields: [
        { name: "key", label: "Schlüssel" }, { name: "name", label: "Name" },
        { name: "weight", label: "Gewicht (%)", kind: "number" }, { name: "sortOrder", label: "Sortierung", kind: "number" },
        { name: "description", label: "Beschreibung", optional: true },
      ],
      searchKeys: ["key", "name"], canEdit: canJob, newLabel: "Kriterium", deleteConfirm: "Bewertungskriterium „{name}“ löschen?",
    },
  ];

  const tabs = [...(canOrg ? orgTabs : []), ...(canJob ? jobTabs : [])];

  return (
    <>
      <PageHeader title="Stammdaten" description="Organisations- und Job-Architektur-Stammdaten pflegen (Gesellschaften, Standorte, Grades, Bewertungskriterien)." />
      <main className="p-6">
        {tabs.length ? (
          <MasterDataTabs tabs={tabs} />
        ) : (
          <div className="rounded-md border border-ez-line bg-white p-6 text-sm text-ez-muted">Für die Stammdatenpflege fehlt die Berechtigung (org:edit bzw. job:edit).</div>
        )}
      </main>
    </>
  );
}
