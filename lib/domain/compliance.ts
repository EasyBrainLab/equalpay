import type { PrismaClient } from "@prisma/client";

export type ComplianceFinding = {
  key: string;
  label: string;
  status: "OK" | "WARN" | "CRITICAL";
  count: number;
  detail: string;
};

export async function collectComplianceFindings(prisma: PrismaClient, tenantId: string): Promise<ComplianceFinding[]> {
  const [
    employeesWithoutJobProfile,
    employeesWithoutPayGrade,
    jobProfilesWithoutEvaluation,
    jobProfilesWithoutComparisonGroup,
    compensationWithoutReason,
    openDisclosures,
    overdueDisclosures,
    openRemediation,
    overdueRemediation,
    activeRetentionPolicies,
    recruitmentWithoutChecks,
  ] = await Promise.all([
    prisma.employee.count({ where: { tenantId, status: "ACTIVE", jobProfileId: null } }),
    prisma.employee.count({ where: { tenantId, status: "ACTIVE", payGradeId: null } }),
    prisma.jobProfile.count({ where: { tenantId, totalPoints: null } }),
    prisma.jobProfile.count({ where: { tenantId, comparisonGroupId: null } }),
    prisma.compensationComponent.count({ where: { tenantId, objectiveReason: null } }),
    prisma.disclosureRequest.count({ where: { tenantId, status: { in: ["RECEIVED", "IN_REVIEW", "WAITING_FOR_LEGAL", "READY"] } } }),
    prisma.disclosureRequest.count({ where: { tenantId, dueAt: { lt: new Date() }, status: { notIn: ["ANSWERED", "CANCELLED"] } } }),
    prisma.remediationAction.count({ where: { tenantId, status: { in: ["OPEN", "IN_PROGRESS", "WAITING_FOR_APPROVAL"] } } }),
    prisma.remediationAction.count({ where: { tenantId, dueAt: { lt: new Date() }, status: { notIn: ["COMPLETED", "CANCELLED"] } } }),
    prisma.retentionPolicy.count({ where: { tenantId, active: true } }),
    prisma.recruitmentPosting.count({ where: { tenantId, status: { not: "CLOSED" }, OR: [{ genderNeutralCheck: false }, { priorPayQuestionBan: false }] } }),
  ]);

  return [
    {
      key: "employeesWithoutJobProfile",
      label: "Mitarbeitende ohne Stellenprofil",
      status: employeesWithoutJobProfile ? "CRITICAL" : "OK",
      count: employeesWithoutJobProfile,
      detail: "Jede aktive Person braucht ein objektiv bewertbares Stellenprofil.",
    },
    {
      key: "employeesWithoutPayGrade",
      label: "Mitarbeitende ohne Grade",
      status: employeesWithoutPayGrade ? "CRITICAL" : "OK",
      count: employeesWithoutPayGrade,
      detail: "Ohne Grade ist keine konsistente Gehaltsbandpruefung moeglich.",
    },
    {
      key: "jobProfilesWithoutEvaluation",
      label: "Stellen ohne Punktebewertung",
      status: jobProfilesWithoutEvaluation ? "CRITICAL" : "OK",
      count: jobProfilesWithoutEvaluation,
      detail: "Gleichwertigkeit muss anhand objektiver Kriterien belegt werden.",
    },
    {
      key: "jobProfilesWithoutComparisonGroup",
      label: "Stellen ohne Vergleichsgruppe",
      status: jobProfilesWithoutComparisonGroup ? "WARN" : "OK",
      count: jobProfilesWithoutComparisonGroup,
      detail: "Vergleichsgruppen sind Grundlage fuer Auskunft und Pay-Gap-Analyse.",
    },
    {
      key: "compensationWithoutReason",
      label: "Verguetung ohne objektiven Grund",
      status: compensationWithoutReason ? "WARN" : "OK",
      count: compensationWithoutReason,
      detail: "Abweichungen muessen sachlich begruendet und historisiert werden.",
    },
    {
      key: "openDisclosures",
      label: "Offene Auskunftsvorgaenge",
      status: openDisclosures ? "WARN" : "OK",
      count: openDisclosures,
      detail: "Auskunftsfristen muessen aktiv ueberwacht werden.",
    },
    {
      key: "overdueDisclosures",
      label: "Ueberfaellige Auskunftsvorgaenge",
      status: overdueDisclosures ? "CRITICAL" : "OK",
      count: overdueDisclosures,
      detail: "Ueberfaellige Vorgange sind ein hohes Compliance-Risiko.",
    },
    {
      key: "openRemediation",
      label: "Offene Abhilfemassnahmen",
      status: openRemediation ? "WARN" : "OK",
      count: openRemediation,
      detail: "5-Prozent-Trigger brauchen dokumentierte Massnahmen oder objektive Begruendung.",
    },
    {
      key: "overdueRemediation",
      label: "Ueberfaellige Abhilfemassnahmen",
      status: overdueRemediation ? "CRITICAL" : "OK",
      count: overdueRemediation,
      detail: "Ueberfaellige Massnahmen koennen gemeinsame Entgeltbewertungen ausloesen.",
    },
    {
      key: "activeRetentionPolicies",
      label: "Aktive Retention Policies",
      status: activeRetentionPolicies ? "OK" : "CRITICAL",
      count: activeRetentionPolicies,
      detail: "Aufbewahrung und Loeschung muessen technisch steuerbar sein.",
    },
    {
      key: "recruitmentWithoutChecks",
      label: "Recruiting ohne Transparenzchecks",
      status: recruitmentWithoutChecks ? "WARN" : "OK",
      count: recruitmentWithoutChecks,
      detail: "Einstiegsentgelt, Geschlechtsneutralitaet und Verbot der Vorvergütungsfrage muessen dokumentiert sein.",
    },
  ];
}
