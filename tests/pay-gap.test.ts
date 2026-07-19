import { describe, expect, it } from "vitest";
import { calculatePayGapRows } from "@/lib/domain/pay-gap";

describe("pay gap", () => {
  it("calculates average and median gap per group", () => {
    const rows = calculatePayGapRows([
      { groupKey: "A", groupLabel: "Group A", gender: "FEMALE", amountCents: 90000 },
      { groupKey: "A", groupLabel: "Group A", gender: "FEMALE", amountCents: 93000 },
      { groupKey: "A", groupLabel: "Group A", gender: "MALE", amountCents: 100000 },
      { groupKey: "A", groupLabel: "Group A", gender: "MALE", amountCents: 102000 },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].triggerFivePercent).toBe(true);
    expect(rows[0].averageGapPercent).toBeGreaterThan(5);
  });
});
