import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { decryptField, encryptField } from "@/lib/security/crypto";
import { median } from "@/lib/domain/pay-gap";
import { toCsv } from "@/lib/domain/csv";

type PaySample = {
  employeeId: string;
  gender: string;
  groupKey: string;
  groupLabel: string;
  amount: number;
  variableAmount: number;
};

function gapPercent(female: number, male: number): number {
  if (!male) return 0;
  return ((male - female) / male) * 100;
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function quartileIndex(amount: number, sortedAmounts: number[]) {
  const position = sortedAmounts.findIndex((value) => value === amount);
  if (position < 0) return 0;
  const ratio = (position + 1) / sortedAmounts.length;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

export async function collectPaySamples(prisma: PrismaClient, tenantId: string): Promise<PaySample[]> {
  const employees = await prisma.employee.findMany({
    where: { tenantId, status: "ACTIVE" },
    include: {
      jobProfile: { include: { comparisonGroup: true } },
      payGrade: true,
      compensation: { where: { approvalStatus: "APPROVED" } },
    },
  });

  return employees.flatMap((employee) => {
    const baseComponents = employee.compensation.filter((component) => component.type === "BASE_SALARY");
    const variableComponents = employee.compensation.filter((component) => component.type !== "BASE_SALARY");
    const base = baseComponents.at(0);
    if (!base) return [];
    const baseAmount = Number(
      decryptField(
        { ciphertext: base.amountCiphertext, keyId: base.amountKeyId, algorithm: "aes-256-gcm" },
        `${tenantId}:${employee.id}:${base.type}`,
      ),
    );
    const variableAmount = variableComponents.reduce((sum, component) => {
      const value = Number(
        decryptField(
          { ciphertext: component.amountCiphertext, keyId: component.amountKeyId, algorithm: "aes-256-gcm" },
          `${tenantId}:${employee.id}:${component.type}`,
        ),
      );
      return sum + value;
    }, 0);
    const group = employee.jobProfile?.comparisonGroup;
    return [
      {
        employeeId: employee.id,
        gender: employee.gender,
        groupKey: group?.code ?? employee.payGrade?.code ?? "UNASSIGNED",
        groupLabel: group?.name ?? employee.payGrade?.name ?? "Nicht zugeordnet",
        amount: baseAmount,
        variableAmount,
      },
    ];
  });
}

export function buildArticle9Csv(samples: PaySample[]) {
  const sortedAmounts = samples.map((sample) => sample.amount + sample.variableAmount).sort((a, b) => a - b);
  const female = samples.filter((sample) => sample.gender === "FEMALE");
  const male = samples.filter((sample) => sample.gender === "MALE");
  const femaleVariable = female.filter((sample) => sample.variableAmount > 0);
  const maleVariable = male.filter((sample) => sample.variableAmount > 0);
  const rows: unknown[][] = [
    ["Kennzahl", "Wert", "Hinweis"],
    ["gender_pay_gap_average_percent", gapPercent(average(female.map((sample) => sample.amount)), average(male.map((sample) => sample.amount))).toFixed(3), "durchschnittliches Grundentgelt"],
    ["gender_pay_gap_median_percent", gapPercent(median(female.map((sample) => sample.amount)), median(male.map((sample) => sample.amount))).toFixed(3), "medianes Grundentgelt"],
    ["variable_pay_gap_average_percent", gapPercent(average(female.map((sample) => sample.variableAmount)), average(male.map((sample) => sample.variableAmount))).toFixed(3), "durchschnittliche variable Verguetung"],
    ["variable_pay_gap_median_percent", gapPercent(median(female.map((sample) => sample.variableAmount)), median(male.map((sample) => sample.variableAmount))).toFixed(3), "mediane variable Verguetung"],
    ["female_variable_pay_share_percent", female.length ? ((femaleVariable.length / female.length) * 100).toFixed(3) : "0.000", "Anteil Frauen mit variabler Verguetung"],
    ["male_variable_pay_share_percent", male.length ? ((maleVariable.length / male.length) * 100).toFixed(3) : "0.000", "Anteil Maenner mit variabler Verguetung"],
    [],
    ["Kategorie", "Beschaeftigte", "Frauen", "Maenner", "Avg Gap %", "Median Gap %"],
  ];

  const groups = new Map<string, PaySample[]>();
  for (const sample of samples) {
    groups.set(sample.groupKey, [...(groups.get(sample.groupKey) ?? []), sample]);
  }
  for (const [groupKey, groupSamples] of groups.entries()) {
    const groupFemale = groupSamples.filter((sample) => sample.gender === "FEMALE").map((sample) => sample.amount);
    const groupMale = groupSamples.filter((sample) => sample.gender === "MALE").map((sample) => sample.amount);
    rows.push([
      groupKey,
      groupSamples.length,
      groupFemale.length,
      groupMale.length,
      gapPercent(average(groupFemale), average(groupMale)).toFixed(3),
      gapPercent(median(groupFemale), median(groupMale)).toFixed(3),
    ]);
  }

  rows.push([], ["Quartil", "Frauen", "Maenner", "Andere/Unbekannt"]);
  for (const quartile of [1, 2, 3, 4]) {
    const quartileSamples = samples.filter((sample) => quartileIndex(sample.amount + sample.variableAmount, sortedAmounts) === quartile);
    rows.push([
      quartile,
      quartileSamples.filter((sample) => sample.gender === "FEMALE").length,
      quartileSamples.filter((sample) => sample.gender === "MALE").length,
      quartileSamples.filter((sample) => !["FEMALE", "MALE"].includes(sample.gender)).length,
    ]);
  }

  return toCsv(rows);
}

export async function createArticle9Report(prisma: PrismaClient, tenantId: string, userId: string, periodStart: Date, periodEnd: Date, payGapAnalysisId?: string) {
  const samples = await collectPaySamples(prisma, tenantId);
  const csv = buildArticle9Csv(samples);
  const checksum = createHash("sha256").update(csv).digest("hex");
  const encrypted = encryptField(csv, `${tenantId}:ARTICLE_9:${periodStart.toISOString()}:${periodEnd.toISOString()}`);
  return prisma.complianceReport.create({
    data: {
      tenantId,
      type: "ARTICLE_9_PAY_GAP",
      status: "GENERATED",
      name: `Art. 9 Pay-Gap-Report ${periodStart.getFullYear()}-${periodEnd.getFullYear()}`,
      periodStart,
      periodEnd,
      generatedById: userId,
      payGapAnalysisId,
      rowCount: csv.split("\n").length,
      exportFormat: "CSV",
      exportChecksumSha256: checksum,
      exportCipher: encrypted.ciphertext,
      findingsJson: {
        employeeCount: samples.length,
        source: "EU Directive 2023/970 Art. 9 mapping",
      },
    },
  });
}
