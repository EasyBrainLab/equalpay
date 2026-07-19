export type PayGapInput = {
  groupKey: string;
  groupLabel: string;
  gender: "FEMALE" | "MALE" | "DIVERSE" | "NOT_DISCLOSED" | "UNKNOWN";
  amountCents: number;
};

export type PayGapRow = {
  groupKey: string;
  groupLabel: string;
  employeeCount: number;
  femaleCount: number;
  maleCount: number;
  averageGapPercent: number;
  medianGapPercent: number;
  triggerFivePercent: boolean;
};

function avg(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

export function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function gap(reference: number, comparison: number) {
  if (!reference) return 0;
  return ((reference - comparison) / reference) * 100;
}

export function calculatePayGapRows(input: PayGapInput[]): PayGapRow[] {
  const grouped = new Map<string, PayGapInput[]>();
  for (const item of input) {
    grouped.set(item.groupKey, [...(grouped.get(item.groupKey) ?? []), item]);
  }

  return [...grouped.entries()].map(([groupKey, rows]) => {
    const female = rows.filter((row) => row.gender === "FEMALE").map((row) => row.amountCents);
    const male = rows.filter((row) => row.gender === "MALE").map((row) => row.amountCents);
    const averageGapPercent = gap(avg(male), avg(female));
    const medianGapPercent = gap(median(male), median(female));
    return {
      groupKey,
      groupLabel: rows[0]?.groupLabel ?? groupKey,
      employeeCount: rows.length,
      femaleCount: female.length,
      maleCount: male.length,
      averageGapPercent,
      medianGapPercent,
      triggerFivePercent: Math.abs(averageGapPercent) >= 5 || Math.abs(medianGapPercent) >= 5,
    };
  });
}
