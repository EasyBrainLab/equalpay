import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { EmployeeCreateForm, EmployeeImportForm } from "@/components/forms/hr-admin-forms";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/session";
import { hasPermission } from "@/lib/security/permissions";

export default async function EmployeesPage() {
  const ctx = await requireAuth();
  const canEdit = hasPermission(ctx.roles, "employees:edit");
  const [employees, companies, segments, sites, departments, jobProfiles, payGrades] = await Promise.all([
    prisma.employee.findMany({
      where: { tenantId: ctx.tenantId },
      include: { company: true, segment: true, department: true, jobProfile: true, payGrade: true },
      orderBy: { displayName: "asc" },
    }),
    prisma.company.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { name: "asc" } }),
    prisma.segment.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { name: "asc" } }),
    prisma.site.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { name: "asc" } }),
    prisma.department.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { name: "asc" } }),
    prisma.jobProfile.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { title: "asc" } }),
    prisma.payGrade.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <>
      <PageHeader title="Mitarbeitende" description="Personenbezogene Daten sind auf das notwendige HR-Nutzungsniveau begrenzt. Analysen sollten pseudonymisiert erfolgen." />
      <main className="space-y-6 p-6">
        {canEdit && (
          <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
            <EmployeeCreateForm
              companies={companies.map((item) => ({ id: item.id, label: `${item.name} (${item.code})` }))}
              segments={segments.map((item) => ({ id: item.id, label: `${item.name} (${item.code})` }))}
              sites={sites.map((item) => ({ id: item.id, label: `${item.name} (${item.code})` }))}
              departments={departments.map((item) => ({ id: item.id, label: `${item.name} (${item.code})` }))}
              jobProfiles={jobProfiles.map((item) => ({ id: item.id, label: `${item.title} (${item.code})` }))}
              payGrades={payGrades.map((item) => ({ id: item.id, label: `${item.code} · ${item.name}` }))}
            />
            <EmployeeImportForm />
          </div>
        )}
        <div className="overflow-hidden rounded-md border border-ez-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-ez-bg text-xs uppercase text-ez-muted">
              <tr>
                <th className="px-3 py-2">Personalnr.</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Pseudonym</th>
                <th className="px-3 py-2">Gesellschaft</th>
                <th className="px-3 py-2">Rolle</th>
                <th className="px-3 py-2">Grade</th>
                <th className="px-3 py-2">FTE</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id} className="border-t border-ez-line">
                  <td className="px-3 py-2 font-mono text-xs">{employee.employeeNumber}</td>
                  <td className="px-3 py-2 font-medium">{employee.displayName}</td>
                  <td className="px-3 py-2">{employee.pseudonym}</td>
                  <td className="px-3 py-2">{employee.company.name}</td>
                  <td className="px-3 py-2">{employee.jobProfile?.title ?? "-"}</td>
                  <td className="px-3 py-2">{employee.payGrade?.code ?? "-"}</td>
                  <td className="px-3 py-2">{Number(employee.fte).toFixed(2)}</td>
                  <td className="px-3 py-2"><Badge tone="good">{employee.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
