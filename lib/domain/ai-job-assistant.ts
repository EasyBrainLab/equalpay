import { createHash } from "node:crypto";
import type { EvaluationCriterion, PayGrade, PrismaClient } from "@prisma/client";
import { calculateEvaluationPoints, gradeForPoints } from "@/lib/domain/evaluation";

export const DEFAULT_AI_JOB_PROMPT_VERSION = "job-architecture-assistant-v1";

export const DEFAULT_AI_JOB_SYSTEM_PROMPT = `
Analysiere die Stellenbeschreibung ausschliesslich als Entwurf fuer eine geschlechtsneutrale Stellenbewertung.
Bewerte die Stelle, nicht die Person.
Nutze objektive Kriterien: Kompetenz, Verantwortung, Belastung/Aufwand und Arbeitsbedingungen.
Erzeuge keine finale Entscheidung. Gib einen Vorschlag mit Evidenz, Unsicherheiten und Bias-Warnungen aus.
Kommunikations-, Koordinations-, Qualitaets-, Pflege- und Schnittstellenarbeit darf nicht stereotyp unterbewertet werden.
`.trim();

type AnalysisInput = {
  text: string;
  sourceFileName: string;
  businessUnit?: string;
  criteria: EvaluationCriterion[];
  payGrades: PayGrade[];
};

type CriterionSuggestion = {
  criterionId: string;
  criterionKey: string;
  name: string;
  score: number;
  weighted: number;
  evidence: string;
};

export type AiJobAnalysis = {
  suggestedTitle: string;
  suggestedCode: string;
  suggestedJobFamily: string;
  suggestedComparisonGroup: string;
  suggestedGradeCode: string | null;
  suggestedTotalPoints: number;
  confidence: number;
  summary: string;
  responsibilities: string;
  requirements: string;
  criteria: CriterionSuggestion[];
  evidence: Array<{ criterion: string; excerpt: string; reasoning: string }>;
  missingInformation: string[];
  biasWarnings: string[];
  model: {
    provider: "LOCAL_HEURISTIC";
    name: "no-external-ai";
    version: "v1";
  };
};

function sentenceContaining(text: string, patterns: RegExp[]) {
  const sentences = text.split(/(?<=[.!?])\s+|\n+/).map((item) => item.trim()).filter(Boolean);
  return sentences.find((sentence) => patterns.some((pattern) => pattern.test(sentence)))?.slice(0, 360) ?? text.slice(0, 260);
}

function scoreByKeywords(text: string, rules: Array<[RegExp, number]>) {
  const hits = rules.reduce((sum, [pattern, weight]) => sum + (pattern.test(text) ? weight : 0), 0);
  return Math.max(1, Math.min(5, 1 + hits));
}

function titleFromText(text: string, fileName: string) {
  const explicit = text.match(/(?:Stellenbezeichnung|Position|Job Title|Rolle)\s*[:\-]\s*([^.;\n]{4,90})/i)?.[1]?.trim();
  if (explicit) return explicit;
  const firstLine = text.split(/[.\n]/).map((item) => item.trim()).find((item) => item.length >= 8 && item.length <= 90);
  if (firstLine) return firstLine.replace(/^(Stellenbeschreibung|Job Description)\s*[:\-]?\s*/i, "").trim();
  return fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
}

function familyFromText(text: string, businessUnit?: string) {
  const lower = text.toLowerCase();
  if (/medical|clinical|science|arzt|medizin|wissenschaft/.test(lower)) return businessUnit || "Medical Affairs";
  if (/quality|qa|qc|gmp|iso|qualitaet/.test(lower)) return businessUnit || "Quality";
  if (/finance|controlling|accounting|buchhaltung/.test(lower)) return businessUnit || "Finance";
  if (/production|manufacturing|produktion|fertigung|anlage/.test(lower)) return businessUnit || "Operations";
  if (/it|software|data|system|cyber|digital/.test(lower)) return businessUnit || "IT / Digital";
  if (/sales|market|customer|vertrieb|kunde/.test(lower)) return businessUnit || "Commercial";
  if (/hr|people|personal|recruiting/.test(lower)) return businessUnit || "Human Resources";
  return businessUnit || "General";
}

function codeFromTitle(title: string) {
  const words = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .slice(0, 4);
  return words.map((word) => word.slice(0, 4).toUpperCase()).join("-") || "JOB-DRAFT";
}

function missingInformation(text: string) {
  const lower = text.toLowerCase();
  const missing = [];
  if (!/budget|kosten|p&l|umsatz|financial|budget/.test(lower)) missing.push("Budget-/Finanzverantwortung nicht eindeutig beschrieben.");
  if (!/team|fuehrung|leitung|disziplinar|people management|direct reports/.test(lower)) missing.push("Fuer Fuehrungsverantwortung fehlen klare Angaben.");
  if (!/gmp|sicherheit|labor|schicht|reise|travel|arbeitsbedingungen|conditions/.test(lower)) missing.push("Besondere Arbeitsbedingungen sind unklar.");
  if (!/abschluss|studium|degree|qualification|kenntnisse|experience|erfahrung/.test(lower)) missing.push("Qualifikations-/Erfahrungsanforderungen sollten praezisiert werden.");
  return missing;
}

function biasWarnings(text: string) {
  const lower = text.toLowerCase();
  const warnings = [];
  if (/koordination|coordination|schnittstelle|stakeholder|kommunikation|communication/.test(lower)) {
    warnings.push("Koordinations-, Kommunikations- und Schnittstellenarbeit fachlich bewerten und nicht als reine Assistenztaetigkeit abwerten.");
  }
  if (/pflege|care|service|support|assistenz|administration/.test(lower)) {
    warnings.push("Service-, Pflege-, Support- und Administrationsanteile auf Verantwortung und Komplexitaet pruefen.");
  }
  if (/qualitaet|quality|compliance|dokumentation|documentation/.test(lower)) {
    warnings.push("Qualitaets- und Compliance-Verantwortung als risikorelevante Verantwortung beruecksichtigen.");
  }
  return warnings;
}

function buildCriterionSuggestions(text: string, criteria: EvaluationCriterion[]): CriterionSuggestion[] {
  const lower = text.toLowerCase();
  return criteria.map((criterion) => {
    const key = criterion.key.toLowerCase();
    const score =
      key.includes("competence")
        ? scoreByKeywords(lower, [[/master|phd|promotion|degree|studium|expert|spezialist|gmp|regulatory/, 1], [/mehrjaehr|senior|advanced|komplex/, 1], [/strategie|scientific|wissenschaft/, 1], [/international|cross-functional|matrix/, 1]])
        : key.includes("responsibility")
          ? scoreByKeywords(lower, [[/budget|p&l|umsatz|freigabe|approval/, 1], [/leitung|lead|fuehrung|team|people management/, 1], [/compliance|risk|gmp|audit|regulatory/, 1], [/entscheidung|decision|stakeholder/, 1]])
          : key.includes("strain")
            ? scoreByKeywords(lower, [[/deadline|druck|urgent|kritisch|24\/7/, 1], [/reise|travel|schicht|shift/, 1], [/komplex|parallel|multiple|eskalation/, 1], [/labor|produktion|anlage|radiation|strahlung/, 1]])
            : scoreByKeywords(lower, [[/labor|produktion|cleanroom|reinraum|anlage|field/, 1], [/reise|travel|external|kunde|customer/, 1], [/sicherheit|safety|gmp|regulated/, 1], [/remote|hybrid|international/, 1]]);
    const weighted = Math.round((score / 5) * criterion.weight);
    const evidence = sentenceContaining(lower, [/expert|senior|lead|budget|gmp|compliance|stakeholder|reise|labor|produktion|qualitaet|responsibility|verantwortung/]);
    return { criterionId: criterion.id, criterionKey: criterion.key, name: criterion.name, score, weighted, evidence };
  });
}

export async function ensureDefaultAiJobPromptVersion(prisma: PrismaClient, tenantId: string, userId?: string) {
  return prisma.aiJobPromptVersion.upsert({
    where: { tenantId_version: { tenantId, version: DEFAULT_AI_JOB_PROMPT_VERSION } },
    update: { active: true },
    create: {
      tenantId,
      version: DEFAULT_AI_JOB_PROMPT_VERSION,
      name: "Sicherer Jobarchitektur-Entwurfsassistent",
      systemPrompt: DEFAULT_AI_JOB_SYSTEM_PROMPT,
      outputSchema: {
        type: "object",
        required: ["suggestedTitle", "criteria", "missingInformation", "biasWarnings", "confidence"],
      },
      createdById: userId,
    },
  });
}

export function promptHash(prompt: string) {
  return createHash("sha256").update(prompt).digest("hex");
}

export function analyzeJobDescription(input: AnalysisInput): AiJobAnalysis {
  const title = titleFromText(input.text, input.sourceFileName);
  const family = familyFromText(input.text, input.businessUnit);
  const code = codeFromTitle(title);
  const criteria = buildCriterionSuggestions(input.text, input.criteria);
  const totalPoints = calculateEvaluationPoints(
    criteria.map((criterion) => ({
      criterionKey: criterion.criterionKey,
      score: criterion.score,
      weight: input.criteria.find((item) => item.id === criterion.criterionId)?.weight ?? 25,
    })),
  );
  const grade = gradeForPoints(totalPoints, input.payGrades);
  const missing = missingInformation(input.text);
  const warnings = biasWarnings(input.text);
  const confidence = Math.max(0.35, Math.min(0.92, 0.72 + (input.text.length > 2500 ? 0.1 : 0) - missing.length * 0.05));

  return {
    suggestedTitle: title,
    suggestedCode: code,
    suggestedJobFamily: family,
    suggestedComparisonGroup: `${family} ${grade?.code ?? "Draft"} Vergleichsgruppe`,
    suggestedGradeCode: grade?.code ?? null,
    suggestedTotalPoints: totalPoints,
    confidence: Number(confidence.toFixed(3)),
    summary: input.text.slice(0, 700),
    responsibilities: sentenceContaining(input.text, [/verantwort|responsib|lead|stakeholder|budget|compliance/i]),
    requirements: sentenceContaining(input.text, [/anforder|requirement|degree|abschluss|erfahrung|experience|kenntnisse/i]),
    criteria,
    evidence: criteria.map((criterion) => ({
      criterion: criterion.name,
      excerpt: criterion.evidence,
      reasoning: `Lokaler Entwurfsadapter hat Score ${criterion.score}/5 anhand regelbasierter Stichworte abgeleitet.`,
    })),
    missingInformation: missing,
    biasWarnings: warnings,
    model: { provider: "LOCAL_HEURISTIC", name: "no-external-ai", version: "v1" },
  };
}
