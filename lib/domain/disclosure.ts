import type { PrismaClient } from "@prisma/client";
import { decryptField, encryptField } from "@/lib/security/crypto";
import { formatMoney } from "@/lib/domain/money";
import { median } from "@/lib/domain/pay-gap";

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function latestBaseAmount(tenantId: string, employeeId: string, compensation: { type: string; amountCiphertext: string; amountKeyId: string }[]) {
  const base = compensation.find((component) => component.type === "BASE_SALARY");
  if (!base) return null;
  return Number(
    decryptField(
      { ciphertext: base.amountCiphertext, keyId: base.amountKeyId, algorithm: "aes-256-gcm" },
      `${tenantId}:${employeeId}:${base.type}`,
    ),
  );
}

export async function generateDisclosureResponse(prisma: PrismaClient, tenantId: string, requestId: string, userId: string) {
  const request = await prisma.disclosureRequest.findFirst({
    where: { id: requestId, tenantId },
  });
  if (!request) throw new Error("Auskunftsvorgang nicht gefunden.");
  if (!request.employeeId) throw new Error("Auskunftsvorgang benoetigt eine Mitarbeiterzuordnung.");

  const employee = await prisma.employee.findFirst({
    where: { id: request.employeeId, tenantId },
    include: {
      jobProfile: { include: { comparisonGroup: true } },
      payGrade: true,
      compensation: { where: { approvalStatus: "APPROVED" }, orderBy: { validFrom: "desc" } },
    },
  });
  if (!employee) throw new Error("Mitarbeiter nicht gefunden.");

  const groupCode = request.comparisonGroup ?? employee.jobProfile?.comparisonGroup?.code ?? employee.payGrade?.code ?? null;
  const groupEmployees = await prisma.employee.findMany({
    where: {
      tenantId,
      status: "ACTIVE",
      OR: groupCode
        ? [
            { jobProfile: { comparisonGroup: { code: groupCode } } },
            { payGrade: { code: groupCode } },
          ]
        : [{ id: employee.id }],
    },
    include: {
      compensation: { where: { approvalStatus: "APPROVED" }, orderBy: { validFrom: "desc" } },
    },
  });

  const rawAmounts = groupEmployees
    .map((item) => ({
      gender: item.gender,
      amount: latestBaseAmount(tenantId, item.id, item.compensation),
    }));
  const amounts: { gender: string; amount: number }[] = rawAmounts.flatMap((item) => (item.amount === null ? [] : [{ gender: item.gender, amount: item.amount }]));
  const female = amounts.filter((item) => item.gender === "FEMALE").map((item) => item.amount);
  const male = amounts.filter((item) => item.gender === "MALE").map((item) => item.amount);
  const employeeAmount = latestBaseAmount(tenantId, employee.id, employee.compensation);
  const encrypted = employeeAmount === null ? null : encryptField(String(employeeAmount), `${tenantId}:${employee.id}:DISCLOSURE:${request.id}`);
  const answerText = [
    `Auskunftsvorgang: ${request.requesterLabel}`,
    `Stellenprofil: ${employee.jobProfile?.title ?? "nicht zugeordnet"}`,
    `Vergleichsgruppe: ${groupCode ?? "nicht zugeordnet"}`,
    `Individuelles Entgelt: ${employeeAmount === null ? "nicht verfuegbar" : formatMoney(employeeAmount)}`,
    `Durchschnitt Frauen: ${female.length ? formatMoney(average(female)) : "nicht auswertbar"}`,
    `Durchschnitt Maenner: ${male.length ? formatMoney(average(male)) : "nicht auswertbar"}`,
    `Median Frauen: ${female.length ? formatMoney(median(female)) : "nicht auswertbar"}`,
    `Median Maenner: ${male.length ? formatMoney(median(male)) : "nicht auswertbar"}`,
    "Hinweis: Antwort vor Herausgabe rechtlich und datenschutzrechtlich pruefen.",
  ].join("\n");

  const response = await prisma.disclosureResponse.create({
    data: {
      tenantId,
      disclosureRequestId: request.id,
      employeeId: employee.id,
      generatedById: userId,
      employeePayAmountCipher: encrypted?.ciphertext,
      employeePayKeyId: encrypted?.keyId,
      comparisonGroup: groupCode,
      comparisonEmployeeCount: amounts.length,
      averagePayFemale: female.length ? Math.round(average(female)) : null,
      averagePayMale: male.length ? Math.round(average(male)) : null,
      medianPayFemale: female.length ? Math.round(median(female)) : null,
      medianPayMale: male.length ? Math.round(median(male)) : null,
      answerText,
      legalReviewRequired: true,
    },
  });
  await prisma.disclosureRequest.update({
    where: { id: request.id },
    data: { status: "WAITING_FOR_LEGAL", responseDocument: response.id },
  });
  return response;
}
