import { Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { RecordManager, type ColumnDef, type FieldDef, type FilterDef } from "@/components/data/record-manager";
import { EmployeeImportButton } from "@/components/forms/employee-import";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/session";
import { hasPermission } from "@/lib/security/permissions";

const genders = ["UNKNOWN", "FEMALE", "MALE", "DIVERSE", "NOT_DISCLOSED"];
const employmentStatuses = ["ACTIVE", "LEAVE", "TERMINATED"];

export default async function EmployeesPage() {
  const ctx = await requireAuth();
  const canEdit = hasPermission(ctx.roles, "employees:edit");
  const [employees, companies, segments, sites, departments, jobProfiles, payGrades] = await Promise.all([
    prisma.employee.findMany({ where: { tenantId: ctx.tenantId }, include: { company: true, segment: true, department: true, jobProfile: true, payGrade: true }, orderBy: { displayName: "asc" } }),
    prisma.company.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { name: "asc" } }),
    prisma.segment.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { name: "asc" } }),
    prisma.site.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { name: "asc" } }),
    prisma.department.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { name: "asc" } }),
    prisma.jobProfile.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { title: "asc" } }),
    prisma.payGrade.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { sortOrder: "asc" } }),
  ]);

  const optList = <T extends { id: string }>(items: T[], label: (item: T) => string) => items.map((item) => ({ id: item.id, label: label(item) }));
  const companyOptions = optList(companies, (item) => `${item.name} (${item.code})`);
  const segmentOptions = optList(segments, (item) => `${item.name} (${item.code})`);
  const siteOptions = optList(sites, (item) => `${item.name} (${item.code})`);
  const departmentOptions = optList(departments, (item) => `${item.name} (${item.code})`);
  const jobProfileOptions = optList(jobProfiles, (item) => `${item.title} (${item.code})`);
  const payGradeOptions = optList(payGrades, (item) => `${item.code} · ${item.name}`);

  const rows = employees.map((item) => ({
    id: item.id,
    employeeNumber: item.employeeNumber,
    displayName: item.displayName,
    pseudonym: item.pseudonym,
    nameSub: `${item.employeeNumber} · ${item.pseudonym}`,
    companyId: item.companyId,
    companyName: item.company.name,
    segmentId: item.segmentId,
    siteId: item.siteId,
    departmentId: item.departmentId,
    gender: item.gender,
    status: item.status,
    fte: Number(item.fte),
    fteDisplay: Number(item.fte).toFixed(2),
    weeklyHours: Number(item.weeklyHours),
    fullTimeHours: Number(item.fullTimeHours),
    jobProfileId: item.jobProfileId,
    jobProfileTitle: item.jobProfile?.title ?? "-",
    payGradeId: item.payGradeId,
    payGradeCode: item.payGrade?.code ?? "-",
  }));

  const columns: ColumnDef[] = [
    { key: "displayName", header: "Name", kind: "subtitle", subtitleKey: "nameSub" },
    { key: "companyName", header: "Gesellschaft" },
    { key: "jobProfileTitle", header: "Rolle" },
    { key: "payGradeCode", header: "Grade" },
    { key: "fteDisplay", header: "FTE" },
    { key: "status", header: "Status", kind: "badge", tone: { ACTIVE: "good", TERMINATED: "danger", "*": "warn" } },
  ];

  const filters: FilterDef[] = [{ field: "status", label: "Status", options: [{ value: "", label: "Alle Status" }, ...employmentStatuses.map((value) => ({ value, label: value }))] }];

  const fields: FieldDef[] = [
    { name: "employeeNumber", label: "Personalnr." },
    { name: "displayName", label: "Name" },
    { name: "pseudonym", label: "Pseudonym" },
    { name: "companyId", label: "Gesellschaft", kind: "select", options: companyOptions },
    { name: "segmentId", label: "Segment", kind: "select", options: segmentOptions, optional: true },
    { name: "siteId", label: "Standort", kind: "select", options: siteOptions, optional: true },
    { name: "departmentId", label: "Abteilung", kind: "select", options: departmentOptions, optional: true },
    { name: "gender", label: "Geschlecht", kind: "select", options: genders.map((value) => ({ id: value, label: value })) },
    { name: "status", label: "Status", kind: "select", options: employmentStatuses.map((value) => ({ id: value, label: value })) },
    { name: "fte", label: "FTE", kind: "number" },
    { name: "weeklyHours", label: "Wochenstunden", kind: "number" },
    { name: "fullTimeHours", label: "Vollzeitstunden", kind: "number" },
    { name: "jobProfileId", label: "Stellenprofil", kind: "select", options: jobProfileOptions, optional: true },
    { name: "payGradeId", label: "Grade", kind: "select", options: payGradeOptions, optional: true },
  ];

  return (
    <>
      <PageHeader title="Mitarbeitende" description="Personenbezogene Daten sind auf das notwendige HR-Nutzungsniveau begrenzt. Analysen sollten pseudonymisiert erfolgen." />
      <main className="p-6">
        <RecordManager
          title="Mitarbeitendenverzeichnis"
          description="Links suchen und auswählen, rechts anlegen oder bearbeiten."
          icon={<Users size={18} />}
          endpoint="/api/employees"
          rows={rows}
          columns={columns}
          fields={fields}
          searchKeys={["displayName", "employeeNumber", "pseudonym"]}
          filters={filters}
          canEdit={canEdit}
          newLabel="Mitarbeiter"
          toolbar={canEdit ? <EmployeeImportButton /> : undefined}
          deleteConfirm="Mitarbeiter {displayName} ({employeeNumber}) löschen? Mitarbeitende mit Vergütungshistorie können nur auf Status TERMINATED gesetzt werden."
        />
      </main>
    </>
  );
}
