import { PageHeader } from "@/components/layout/page-header";
import { MasterDataSection, type MdField, type MdRow } from "@/components/forms/master-data-forms";
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
    prisma.segment.findMany({ where, orderBy: { name: "asc" } }),
    prisma.site.findMany({ where, orderBy: { name: "asc" } }),
    prisma.department.findMany({ where, orderBy: { name: "asc" } }),
    prisma.jobFamily.findMany({ where, orderBy: { name: "asc" } }),
    prisma.payGrade.findMany({ where, orderBy: { sortOrder: "asc" } }),
    prisma.comparisonGroup.findMany({ where, orderBy: { name: "asc" } }),
    prisma.evaluationCriterion.findMany({ where, orderBy: { sortOrder: "asc" } }),
  ]);

  const companyOptions = companies.map((item) => ({ id: item.id, label: `${item.name} (${item.code})` }));

  const companyRows: MdRow[] = companies.map((item) => ({ id: item.id, label: `${item.name} (${item.code})`, values: { name: item.name, code: item.code, country: item.country } }));
  const segmentRows: MdRow[] = segments.map((item) => ({ id: item.id, label: `${item.name} (${item.code})`, values: { name: item.name, code: item.code, companyId: str(item.companyId) } }));
  const siteRows: MdRow[] = sites.map((item) => ({ id: item.id, label: `${item.name} (${item.code})`, values: { name: item.name, code: item.code, companyId: item.companyId } }));
  const departmentRows: MdRow[] = departments.map((item) => ({ id: item.id, label: `${item.name} (${item.code})`, values: { name: item.name, code: item.code, companyId: item.companyId } }));
  const jobFamilyRows: MdRow[] = jobFamilies.map((item) => ({ id: item.id, label: `${item.name} (${item.code})`, values: { name: item.name, code: item.code, description: str(item.description) } }));
  const payGradeRows: MdRow[] = payGrades.map((item) => ({ id: item.id, label: `${item.code} · ${item.name}`, values: { code: item.code, name: item.name, minPoints: str(item.minPoints), maxPoints: str(item.maxPoints), sortOrder: str(item.sortOrder), description: str(item.description) } }));
  const comparisonRows: MdRow[] = comparisonGroups.map((item) => ({ id: item.id, label: `${item.name} (${item.code})`, values: { code: item.code, name: item.name, description: str(item.description) } }));
  const criteriaRows: MdRow[] = criteria.map((item) => ({ id: item.id, label: item.name, values: { key: item.key, name: item.name, weight: str(item.weight), sortOrder: str(item.sortOrder), description: str(item.description) } }));

  const textCode: MdField[] = [
    { name: "name", label: "Name" },
    { name: "code", label: "Code" },
  ];
  const companyField: MdField = { name: "companyId", label: "Gesellschaft", kind: "select", options: companyOptions };

  return (
    <>
      <PageHeader title="Stammdaten" description="Organisations- und Job-Architektur-Stammdaten pflegen (Gesellschaften, Standorte, Grades, Bewertungskriterien)." />
      <main className="space-y-6 p-6">
        {!canOrg && !canJob && (
          <div className="rounded-md border border-ez-line bg-white p-6 text-sm text-ez-muted">
            Fuer die Stammdatenpflege fehlt die Berechtigung (org:edit bzw. job:edit).
          </div>
        )}

        {canOrg && (
          <>
            <MasterDataSection title="Gesellschaften" description="Rechtseinheiten des Mandanten." endpoint="/api/master-data/companies" rows={companyRows}
              fields={[{ name: "name", label: "Name" }, { name: "code", label: "Code" }, { name: "country", label: "Land (ISO-2)" }]} />
            <MasterDataSection title="Segmente" description="Geschaeftssegmente (optional einer Gesellschaft zugeordnet)." endpoint="/api/master-data/segments" rows={segmentRows}
              fields={[...textCode, { ...companyField, optional: true }]} />
            <MasterDataSection title="Standorte" description="Standorte je Gesellschaft." endpoint="/api/master-data/sites" rows={siteRows}
              fields={[...textCode, companyField]} />
            <MasterDataSection title="Abteilungen" description="Abteilungen je Gesellschaft." endpoint="/api/master-data/departments" rows={departmentRows}
              fields={[...textCode, companyField]} />
          </>
        )}

        {canJob && (
          <>
            <MasterDataSection title="Jobfamilien" description="Fachliche Gruppierung von Stellenprofilen." endpoint="/api/master-data/job-families" rows={jobFamilyRows}
              fields={[...textCode, { name: "description", label: "Beschreibung", optional: true }]} />
            <MasterDataSection title="Grades" description="Bewertungs-Grades (Punktekorridor, Sortierung)." endpoint="/api/master-data/pay-grades" rows={payGradeRows}
              fields={[
                { name: "code", label: "Code" },
                { name: "name", label: "Name" },
                { name: "minPoints", label: "Min. Punkte", kind: "number" },
                { name: "maxPoints", label: "Max. Punkte", kind: "number" },
                { name: "sortOrder", label: "Sortierung", kind: "number" },
                { name: "description", label: "Beschreibung", optional: true },
              ]} />
            <MasterDataSection title="Vergleichsgruppen" description="Gruppen fuer Auskunft/Pay-Gap-Vergleiche." endpoint="/api/master-data/comparison-groups" rows={comparisonRows}
              fields={[{ name: "code", label: "Code" }, { name: "name", label: "Name" }, { name: "description", label: "Beschreibung", optional: true }]} />
            <MasterDataSection title="Bewertungskriterien" description="Gewichtete Kriterien der Stellenbewertung." endpoint="/api/master-data/evaluation-criteria" rows={criteriaRows}
              fields={[
                { name: "key", label: "Schluessel" },
                { name: "name", label: "Name" },
                { name: "weight", label: "Gewicht (%)", kind: "number" },
                { name: "sortOrder", label: "Sortierung", kind: "number" },
                { name: "description", label: "Beschreibung", optional: true },
              ]} />
          </>
        )}
      </main>
    </>
  );
}
