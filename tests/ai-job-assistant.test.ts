import { describe, expect, it } from "vitest";
import { analyzeJobDescription, DEFAULT_AI_JOB_SYSTEM_PROMPT, promptHash } from "@/lib/domain/ai-job-assistant";
import { extractTextFromFile } from "@/lib/domain/document-extraction";

const criteria = [
  { id: "c1", tenantId: "t1", key: "competence", name: "Kompetenz", weight: 25, description: null, sortOrder: 1, createdAt: new Date(), updatedAt: new Date() },
  { id: "c2", tenantId: "t1", key: "responsibility", name: "Verantwortung", weight: 25, description: null, sortOrder: 2, createdAt: new Date(), updatedAt: new Date() },
  { id: "c3", tenantId: "t1", key: "strain", name: "Belastung", weight: 25, description: null, sortOrder: 3, createdAt: new Date(), updatedAt: new Date() },
  { id: "c4", tenantId: "t1", key: "conditions", name: "Arbeitsbedingungen", weight: 25, description: null, sortOrder: 4, createdAt: new Date(), updatedAt: new Date() },
];

const payGrades = [
  { id: "g1", tenantId: "t1", code: "M1", name: "Entry", minPoints: 0, maxPoints: 39, sortOrder: 1, description: null, createdAt: new Date(), updatedAt: new Date() },
  { id: "g2", tenantId: "t1", code: "M4", name: "Senior", minPoints: 40, maxPoints: 74, sortOrder: 2, description: null, createdAt: new Date(), updatedAt: new Date() },
  { id: "g3", tenantId: "t1", code: "M6", name: "Expert", minPoints: 75, maxPoints: 100, sortOrder: 3, description: null, createdAt: new Date(), updatedAt: new Date() },
];

describe("ai job assistant", () => {
  it("creates a deterministic draft analysis without external model access", () => {
    const analysis = analyzeJobDescription({
      text: "Stellenbezeichnung: Senior Medical Science Liaison. Verantwortung fuer GMP-nahe Compliance, wissenschaftliche Stakeholder-Kommunikation, komplexe Projekte und internationale Abstimmung. Anforderungen: Studium, mehrjaehrige Erfahrung, Expertenkenntnisse.",
      sourceFileName: "senior-msl.txt",
      businessUnit: "Medical",
      criteria,
      payGrades,
    });

    expect(analysis.model.provider).toBe("LOCAL_HEURISTIC");
    expect(analysis.suggestedTitle).toBe("Senior Medical Science Liaison");
    expect(analysis.suggestedTotalPoints).toBeGreaterThan(40);
    expect(analysis.criteria).toHaveLength(4);
    expect(analysis.biasWarnings.length).toBeGreaterThan(0);
  });

  it("redacts direct personal data during local text extraction", async () => {
    const file = new File(["Kontakt max.mustermann@example.com, Telefon +49 30 12345678. Stellenbezeichnung: Quality Expert mit GMP Verantwortung."], "job.txt", {
      type: "text/plain",
    });
    const result = await extractTextFromFile(file);

    expect(result.text).toContain("[REDACTED_EMAIL]");
    expect(result.text).toContain("[REDACTED_PHONE]");
    expect(result.redactionSummary.email).toBe(1);
  });

  it("hashes prompt versions for auditability", () => {
    expect(promptHash(DEFAULT_AI_JOB_SYSTEM_PROMPT)).toHaveLength(64);
  });
});
