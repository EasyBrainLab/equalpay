import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { DisclosureResponseButton, DisclosureManageForm } from "@/components/forms/hr-admin-forms";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/session";
import { hasPermission } from "@/lib/security/permissions";

function tone(status: string) {
  if (status === "ANSWERED") return "good" as const;
  if (status === "OVERDUE") return "danger" as const;
  return "warn" as const;
}

export default async function DisclosuresPage() {
  const ctx = await requireAuth();
  const canEdit = hasPermission(ctx.roles, "disclosure:edit");
  const [requests, employees] = await Promise.all([
    prisma.disclosureRequest.findMany({
      where: { tenantId: ctx.tenantId },
      include: { responses: { orderBy: { generatedAt: "desc" }, take: 1 } },
      orderBy: [{ status: "asc" }, { dueAt: "asc" }],
    }),
    prisma.employee.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { displayName: "asc" } }),
  ]);

  return (
    <>
      <PageHeader title="Auskunftsanfragen" description="Fristen, Vergleichsgruppen, Datenschutzpruefung und Antwortstatus." />
      <main className="space-y-6 p-6">
        {canEdit && (
          <DisclosureManageForm
            requests={requests.map((request) => ({
              id: request.id,
              requesterLabel: request.requesterLabel,
              employeeId: request.employeeId,
              comparisonGroup: request.comparisonGroup,
              notes: request.notes,
              status: request.status,
              dueAt: request.dueAt.toISOString().slice(0, 10),
            }))}
            employees={employees.map((employee) => ({ id: employee.id, label: `${employee.displayName} (${employee.employeeNumber})` }))}
          />
        )}
        <div className="overflow-hidden rounded-md border border-ez-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-ez-bg text-xs uppercase text-ez-muted">
              <tr>
                <th className="px-3 py-2">Anfragende Person</th>
                <th className="px-3 py-2">Eingang</th>
                <th className="px-3 py-2">Faellig</th>
                <th className="px-3 py-2">Vergleichsgruppe</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Antwort</th>
                <th className="px-3 py-2">Notiz</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id} className="border-t border-ez-line">
                  <td className="px-3 py-2 font-medium">{request.requesterLabel}</td>
                  <td className="px-3 py-2">{request.receivedAt.toLocaleDateString("de-DE")}</td>
                  <td className="px-3 py-2">{request.dueAt.toLocaleDateString("de-DE")}</td>
                  <td className="px-3 py-2">{request.comparisonGroup ?? "-"}</td>
                  <td className="px-3 py-2"><Badge tone={tone(request.status)}>{request.status}</Badge></td>
                  <td className="px-3 py-2">
                    {request.responses[0] ? (
                      <div className="text-xs text-ez-muted">generiert {request.responses[0].generatedAt.toLocaleDateString("de-DE")}</div>
                    ) : canEdit ? (
                      <DisclosureResponseButton requestId={request.id} />
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-3 py-2 text-ez-muted">{request.notes ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
