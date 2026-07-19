export type EvaluationInput = {
  criterionKey: string;
  score: number;
  weight: number;
};

export function calculateEvaluationPoints(input: EvaluationInput[]): number {
  const totalWeight = input.reduce((sum, item) => sum + item.weight, 0);
  if (!totalWeight) return 0;
  const weightedScore = input.reduce((sum, item) => sum + item.score * item.weight, 0);
  return Math.round((weightedScore / (5 * totalWeight)) * 100);
}

export function gradeForPoints<T extends { minPoints: number; maxPoints: number }>(
  points: number,
  grades: T[],
): T | null {
  return grades.find((grade) => points >= grade.minPoints && points <= grade.maxPoints) ?? null;
}
