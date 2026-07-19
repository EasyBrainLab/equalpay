import { PrismaClient } from "@prisma/client";
import { encryptField, moneyLast4 } from "../lib/security/crypto";
import { DEFAULT_AI_JOB_PROMPT_VERSION, DEFAULT_AI_JOB_SYSTEM_PROMPT } from "../lib/domain/ai-job-assistant";
import { hashPassword } from "../lib/security/password";

const prisma = new PrismaClient();

function seedPassword(envKey: string, localDefault: string): string {
  const value = process.env[envKey];
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error(`${envKey} must be set when running prisma db seed in production.`);
  }
  return localDefault;
}

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: "ezag" },
    update: {},
    create: { name: "Eckert & Ziegler", slug: "ezag" },
  });

  const company = await prisma.company.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "EZ-MED" } },
    update: {},
    create: { tenantId: tenant.id, name: "Medical Segment", code: "EZ-MED", country: "DE" },
  });

  const segment = await prisma.segment.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "MED" } },
    update: {},
    create: { tenantId: tenant.id, companyId: company.id, name: "Medical", code: "MED" },
  });

  const site = await prisma.site.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "BER" } },
    update: {},
    create: { tenantId: tenant.id, companyId: company.id, name: "Berlin", code: "BER" },
  });

  const department = await prisma.department.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "MEDAFF" } },
    update: {},
    create: { tenantId: tenant.id, companyId: company.id, name: "Medical Affairs", code: "MEDAFF" },
  });

  const passwordHash = await hashPassword(seedPassword("SEED_HR_ADMIN_PASSWORD", "ChangeMe-Entgelt-2026"));
  const user = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "hr.admin@example.local" } },
    update: { passwordHash },
    create: {
      tenantId: tenant.id,
      email: "hr.admin@example.local",
      name: "HR Admin",
      passwordHash,
      mfaRequired: false,
      roles: { create: [{ tenantId: tenant.id, role: "HR_ADMIN" }] },
    },
  });
  const systemAdminPasswordHash = await hashPassword(seedPassword("SEED_SYSTEM_ADMIN_PASSWORD", "ChangeMe-System-2026"));
  const systemAdmin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "system.admin@example.local" } },
    update: { passwordHash: systemAdminPasswordHash },
    create: {
      tenantId: tenant.id,
      email: "system.admin@example.local",
      name: "System Admin",
      passwordHash: systemAdminPasswordHash,
      mfaRequired: false,
      roles: { create: [{ tenantId: tenant.id, role: "SYSTEM_ADMIN" }] },
    },
  });
  const securityAdminPasswordHash = await hashPassword(seedPassword("SEED_SECURITY_ADMIN_PASSWORD", "ChangeMe-Security-2026"));
  const securityAdmin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "security.admin@example.local" } },
    update: { passwordHash: securityAdminPasswordHash },
    create: {
      tenantId: tenant.id,
      email: "security.admin@example.local",
      name: "Security Admin",
      passwordHash: securityAdminPasswordHash,
      mfaRequired: false,
      roles: { create: [{ tenantId: tenant.id, role: "SECURITY_ADMIN" }] },
    },
  });
  for (const [targetUserId, role] of [
    [user.id, "HR_ADMIN"],
    [systemAdmin.id, "SYSTEM_ADMIN"],
    [securityAdmin.id, "SECURITY_ADMIN"],
  ] as const) {
    const existingRole = await prisma.roleAssignment.findFirst({
      where: { tenantId: tenant.id, userId: targetUserId, role },
    });
    if (!existingRole) {
      await prisma.roleAssignment.create({ data: { tenantId: tenant.id, userId: targetUserId, role } });
    }
  }

  for (const [entityType, retentionDays, action, legalBasis] of [
    ["CompensationComponent", 3650, "REVIEW", "Nachweis Entgelttransparenz und arbeitsrechtliche Verjaehrung"],
    ["DisclosureRequest", 1095, "REVIEW", "Dokumentation von Auskunftsvorgaengen"],
    ["AuditLog", 2190, "LEGAL_HOLD", "IT-Sicherheits- und Compliance-Nachweis"],
    ["RecruitmentPosting", 1095, "REVIEW", "Nachweis Bewerbungsprozess-Transparenz"],
  ] as const) {
    await prisma.retentionPolicy.upsert({
      where: { tenantId_entityType: { tenantId: tenant.id, entityType } },
      update: { retentionDays, action, legalBasis, active: true },
      create: { tenantId: tenant.id, entityType, retentionDays, action, legalBasis, active: true },
    });
  }

  await prisma.aiJobPromptVersion.upsert({
    where: { tenantId_version: { tenantId: tenant.id, version: DEFAULT_AI_JOB_PROMPT_VERSION } },
    update: { active: true, systemPrompt: DEFAULT_AI_JOB_SYSTEM_PROMPT },
    create: {
      tenantId: tenant.id,
      version: DEFAULT_AI_JOB_PROMPT_VERSION,
      name: "Sicherer Jobarchitektur-Entwurfsassistent",
      systemPrompt: DEFAULT_AI_JOB_SYSTEM_PROMPT,
      outputSchema: {
        type: "object",
        required: ["suggestedTitle", "criteria", "missingInformation", "biasWarnings", "confidence"],
      },
      active: true,
      createdById: user.id,
    },
  });

  const criteria = [
    ["competence", "Kompetenz", 25, 1],
    ["responsibility", "Verantwortung", 25, 2],
    ["strain", "Belastung", 25, 3],
    ["conditions", "Arbeitsbedingungen", 25, 4],
  ] as const;
  for (const [key, name, weight, sortOrder] of criteria) {
    await prisma.evaluationCriterion.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key } },
      update: { name, weight, sortOrder },
      create: { tenantId: tenant.id, key, name, weight, sortOrder },
    });
  }

  const gradeDefinitions = [
    ["M1", "Entry / Assistenz", 0, 24, 1],
    ["M2", "Associate", 25, 39, 2],
    ["M3", "Professional", 40, 54, 3],
    ["M4", "Senior Professional", 55, 69, 4],
    ["M5", "Lead / Expert", 70, 82, 5],
    ["M6", "Head / Senior Expert", 83, 92, 6],
    ["M7", "Segment Leadership", 93, 100, 7],
  ] as const;
  const grades = new Map<string, string>();
  for (const [code, name, minPoints, maxPoints, sortOrder] of gradeDefinitions) {
    const grade = await prisma.payGrade.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code } },
      update: { name, minPoints, maxPoints, sortOrder },
      create: { tenantId: tenant.id, code, name, minPoints, maxPoints, sortOrder },
    });
    grades.set(code, grade.id);
  }

  const family = await prisma.jobFamily.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "MED-AFFAIRS" } },
    update: {},
    create: { tenantId: tenant.id, code: "MED-AFFAIRS", name: "Medical Affairs" },
  });

  const comparisonGroup = await prisma.comparisonGroup.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "MED-SENIOR-SPECIALISTS" } },
    update: {},
    create: {
      tenantId: tenant.id,
      code: "MED-SENIOR-SPECIALISTS",
      name: "Medical Senior Specialists",
      description: "Gleichwertige seniorige Fachrollen im Medical Segment",
    },
  });

  const jobProfile = await prisma.jobProfile.upsert({
    where: { tenantId_code_version: { tenantId: tenant.id, code: "MED-MSL-SENIOR", version: 1 } },
    update: {},
    create: {
      tenantId: tenant.id,
      jobFamilyId: family.id,
      payGradeId: grades.get("M4"),
      comparisonGroupId: comparisonGroup.id,
      title: "Senior Medical Science Liaison",
      code: "MED-MSL-SENIOR",
      status: "APPROVED",
      totalPoints: 66,
      summary: "Seniorige medizinisch-wissenschaftliche Schnittstellenrolle mit hoher Fach- und Kommunikationsverantwortung.",
      responsibilities: "Stakeholder-Kommunikation, medizinische Evidenz, interne Beratung, Compliance-nahe Abstimmungen.",
      requirements: "Naturwissenschaftlicher oder medizinischer Hochschulabschluss, relevante Erfahrung, sichere Fachkommunikation.",
    },
  });

  await prisma.salaryBand.deleteMany({ where: { tenantId: tenant.id } });
  for (const [code, amounts] of [
    ["M3", [6500000, 7800000, 9100000]],
    ["M4", [7800000, 9400000, 11200000]],
    ["M5", [9500000, 11800000, 14100000]],
  ] as const) {
    await prisma.salaryBand.create({
      data: {
        tenantId: tenant.id,
        payGradeId: grades.get(code)!,
        name: `${code} Medical Band`,
        fullTimeHours: 40,
        minAmount: amounts[0],
        midAmount: amounts[1],
        maxAmount: amounts[2],
        validFrom: new Date("2026-01-01"),
      },
    });
  }

  const employees = [
    ["E-1001", "Dr. Anna Beispiel", "MED-001", "FEMALE", 9000000],
    ["E-1002", "Dr. Stefan Beispiel", "MED-002", "MALE", 9800000],
    ["E-1003", "Dr. Maria Beispiel", "MED-003", "FEMALE", 9300000],
    ["E-1004", "Dr. Thomas Beispiel", "MED-004", "MALE", 10100000],
  ] as const;

  await prisma.compensationComponent.deleteMany({ where: { tenantId: tenant.id } });
  for (const [employeeNumber, displayName, pseudonym, gender, amountCents] of employees) {
    const employee = await prisma.employee.upsert({
      where: { tenantId_employeeNumber: { tenantId: tenant.id, employeeNumber } },
      update: {},
      create: {
        tenantId: tenant.id,
        companyId: company.id,
        segmentId: segment.id,
        siteId: site.id,
        departmentId: department.id,
        employeeNumber,
        displayName,
        pseudonym,
        gender,
        fte: 1,
        weeklyHours: 40,
        fullTimeHours: 40,
        jobProfileId: jobProfile.id,
        payGradeId: grades.get("M4"),
        hiredAt: new Date("2023-01-01"),
      },
    });
    const encrypted = encryptField(String(amountCents), `${tenant.id}:${employee.id}:BASE_SALARY`);
    await prisma.compensationComponent.create({
      data: {
        tenantId: tenant.id,
        employeeId: employee.id,
        type: "BASE_SALARY",
        label: "Jahresgrundgehalt",
        amountCiphertext: encrypted.ciphertext,
        amountKeyId: encrypted.keyId,
        amountLast4: moneyLast4(amountCents),
        validFrom: new Date("2026-01-01"),
        legalBasis: "Medical Compensation Governance",
        objectiveReason: "Initialer Demodatensatz fuer Pay-Gap-Dry-Run",
        approvalStatus: "APPROVED",
      },
    });
  }

  await prisma.recruitmentPosting.upsert({
    where: { id: "demo-recruiting-med-msl-senior" },
    update: {},
    create: {
      id: "demo-recruiting-med-msl-senior",
      tenantId: tenant.id,
      jobProfileId: jobProfile.id,
      title: "Senior Medical Science Liaison",
      location: "Berlin",
      status: "APPROVED",
      salaryMinAmount: 7800000,
      salaryMaxAmount: 11200000,
      currency: "EUR",
      payTransparencyText: "Die Einstiegsverguetung liegt je nach Erfahrung und objektiver Stellenbewertung im Band M4.",
      genderNeutralCheck: true,
      priorPayQuestionBan: true,
    },
  });

  const disclosureDueAt = new Date();
  disclosureDueAt.setMonth(disclosureDueAt.getMonth() + 2);
  await prisma.disclosureRequest.upsert({
    where: { id: "demo-disclosure-med-001" },
    update: {},
    create: {
      id: "demo-disclosure-med-001",
      tenantId: tenant.id,
      employeeId: (await prisma.employee.findUniqueOrThrow({ where: { tenantId_employeeNumber: { tenantId: tenant.id, employeeNumber: "E-1001" } } })).id,
      requesterLabel: "MED-001",
      comparisonGroup: "MED-SENIOR-SPECIALISTS",
      dueAt: disclosureDueAt,
      notes: "Demo-Auskunftsvorgang fuer Antwortgenerierung.",
    },
  });

  await prisma.auditLog.create({
    data: {
      tenantId: tenant.id,
      userId: user.id,
      action: "system.seed",
      entityType: "Tenant",
      entityId: tenant.id,
      metadata: { demoLogin: "hr.admin@example.local", demoPassword: "ChangeMe-Entgelt-2026" },
    },
  });

  console.log("Seed completed. HR: hr.admin@example.local / ChangeMe-Entgelt-2026");
  console.log("Seed completed. System: system.admin@example.local / ChangeMe-System-2026");
  console.log("Seed completed. Security: security.admin@example.local / ChangeMe-Security-2026");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
