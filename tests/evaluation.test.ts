import { describe, expect, it } from "vitest";
import { calculateEvaluationPoints, gradeForPoints } from "@/lib/domain/evaluation";

describe("evaluation", () => {
  it("calculates normalized 100 point score", () => {
    expect(
      calculateEvaluationPoints([
        { criterionKey: "competence", score: 4, weight: 25 },
        { criterionKey: "responsibility", score: 4, weight: 25 },
        { criterionKey: "strain", score: 3, weight: 25 },
        { criterionKey: "conditions", score: 2, weight: 25 },
      ]),
    ).toBe(65);
  });

  it("maps points to grade", () => {
    const grade = gradeForPoints(66, [
      { minPoints: 55, maxPoints: 69, code: "M4" },
      { minPoints: 70, maxPoints: 82, code: "M5" },
    ]);
    expect(grade?.code).toBe("M4");
  });
});
