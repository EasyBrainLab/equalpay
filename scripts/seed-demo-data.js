const { PrismaClient } = require("@prisma/client");
const { createCipheriv, createHash, randomBytes, scrypt } = require("node:crypto");
const { promisify } = require("node:util");

const prisma = new PrismaClient();
const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;
const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const KEY_ID = "local-master-key-v1";
const DEMO_PASSWORD = "DemoEZAG2026!";

function date(value) {
  return new Date(`${value}T00:00:00.000Z`);
}

function contentHash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function getMasterKey() {
  const value = process.env.FIELD_ENCRYPTION_MASTER_KEY_B64;
  if (!value) throw new Error("FIELD_ENCRYPTION_MASTER_KEY_B64 is required.");
  const key = Buffer.from(value, "base64");
  if (key.length !== 32) throw new Error("FIELD_ENCRYPTION_MASTER_KEY_B64 must decode to 32 bytes.");
  return key;
}

function encryptField(plainText, aad) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, getMasterKey(), iv);
  if (aad) cipher.setAAD(Buffer.from(aad));
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

function moneyLast4(cents) {
  return Math.abs(cents).toString().slice(-4).padStart(4, "0");
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString("base64url");
  const derived = await scryptAsync(password, salt, KEY_LENGTH);
  return `scrypt-v1$${salt}$${derived.toString("base64url")}`;
}

async function ensureRole(tenantId, userId, role) {
  const existing = await prisma.roleAssignment.findFirst({ where: { tenantId, userId, role } });
  if (!existing) await prisma.roleAssignment.create({ data: { tenantId, userId, role } });
}

async function ensureDemoUser(tenantId, email, name, roles) {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const user = await prisma.user.upsert({
    where: { tenantId_email: { tenantId, email } },
    update: { name, authProvider: "LOCAL", passwordHash, status: "ACTIVE", mfaRequired: false },
    create: { tenantId, email, name, authProvider: "LOCAL", passwordHash, status: "ACTIVE", mfaRequired: false },
  });
  for (const role of roles) await ensureRole(tenantId, user.id, role);
  return user;
}

async function upsertCompensation(component) {
  const encrypted = encryptField(String(component.amountCents), `${component.tenantId}:${component.employeeId}:${component.type}`);
  return prisma.compensationComponent.upsert({
    where: { id: component.id },
    update: {
      label: component.label,
      amountCiphertext: encrypted,
      amountKeyId: KEY_ID,
      amountLast4: moneyLast4(component.amountCents),
      currency: component.currency || "EUR",
      validFrom: component.validFrom,
      validTo: component.validTo || null,
      legalBasis: component.legalBasis,
      objectiveReason: component.objectiveReason,
      approvalStatus: component.approvalStatus,
    },
    create: {
      id: component.id,
      tenantId: component.tenantId,
      employeeId: component.employeeId,
      type: component.type,
      label: component.label,
      amountCiphertext: encrypted,
      amountKeyId: KEY_ID,
      amountLast4: moneyLast4(component.amountCents),
      currency: component.currency || "EUR",
      validFrom: component.validFrom,
      validTo: component.validTo || null,
      legalBasis: component.legalBasis,
      objectiveReason: component.objectiveReason,
      approvalStatus: component.approvalStatus,
    },
  });
}

async function upsertDocument(tenantId, userId, item) {
  const document = await prisma.document.upsert({
    where: { id: item.id },
    update: { title: item.title, type: item.type, sensitivity: item.sensitivity },
    create: { id: item.id, tenantId, title: item.title, type: item.type, sensitivity: item.sensitivity },
  });
  const bytes = Buffer.from(item.content, "utf8");
  const checksum = contentHash(item.content);
  await prisma.documentVersion.upsert({
    where: { id: `${item.id}-v1` },
    update: {
      fileName: item.fileName,
      mimeType: item.mimeType,
      sizeBytes: bytes.length,
      storageKey: `db://${tenantId}/${checksum}`,
      contentCipher: encryptField(bytes.toString("base64"), `${tenantId}:${checksum}`),
      encryptionKeyId: KEY_ID,
      checksumSha256: checksum,
      uploadedByUserId: userId,
    },
    create: {
      id: `${item.id}-v1`,
      documentId: document.id,
      version: 1,
      fileName: item.fileName,
      mimeType: item.mimeType,
      sizeBytes: bytes.length,
      storageKey: `db://${tenantId}/${checksum}`,
      contentCipher: encryptField(bytes.toString("base64"), `${tenantId}:${checksum}`),
      encryptionKeyId: KEY_ID,
      checksumSha256: checksum,
      uploadedByUserId: userId,
    },
  });
  return document;
}

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: "ezag" },
    update: { name: "Eckert & Ziegler" },
    create: { name: "Eckert & Ziegler", slug: "ezag" },
  });

  const admin = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email: "admin@easybrainlab.com" },
  });

  const hrAdmin = await ensureDemoUser(tenant.id, "demo.hr-admin@easybrainlab.com", "Demo HR Admin", ["HR_ADMIN"]);
  const compManager = await ensureDemoUser(tenant.id, "demo.compensation@easybrainlab.com", "Demo Compensation Manager", [
    "COMPENSATION_MANAGER",
    "HR_ANALYST",
  ]);
  const legal = await ensureDemoUser(tenant.id, "demo.legal@easybrainlab.com", "Demo Legal Reviewer", ["LEGAL_REVIEWER"]);
  const worksCouncil = await ensureDemoUser(tenant.id, "demo.betriebsrat@easybrainlab.com", "Demo Arbeitnehmervertretung", [
    "EMPLOYEE_REP_REVIEWER",
  ]);
  const auditor = await ensureDemoUser(tenant.id, "demo.audit@easybrainlab.com", "Demo Auditor", ["AUDITOR"]);
  const importer = await ensureDemoUser(tenant.id, "demo.import@easybrainlab.com", "Demo Import Operator", ["IMPORT_OPERATOR"]);

  const companies = {};
  for (const [code, name, country] of [
    ["EZ-MED", "Medical Segment", "DE"],
    ["EZ-HOLD", "Corporate Functions", "DE"],
    ["EZ-RAD", "Radiopharma Operations", "DE"],
  ]) {
    companies[code] = await prisma.company.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code } },
      update: { name, country },
      create: { tenantId: tenant.id, code, name, country },
    });
  }

  const segments = {};
  for (const [code, name, companyCode] of [
    ["MED", "Medical", "EZ-MED"],
    ["CORP", "Corporate", "EZ-HOLD"],
    ["RAD", "Radiopharma", "EZ-RAD"],
  ]) {
    segments[code] = await prisma.segment.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code } },
      update: { name, companyId: companies[companyCode].id },
      create: { tenantId: tenant.id, code, name, companyId: companies[companyCode].id },
    });
  }

  const sites = {};
  for (const [code, name, companyCode] of [
    ["BER", "Berlin", "EZ-MED"],
    ["BRA", "Braunschweig", "EZ-RAD"],
    ["HQ", "Berlin Headquarter", "EZ-HOLD"],
  ]) {
    sites[code] = await prisma.site.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code } },
      update: { name, companyId: companies[companyCode].id },
      create: { tenantId: tenant.id, code, name, companyId: companies[companyCode].id },
    });
  }

  const departments = {};
  for (const [code, name, companyCode] of [
    ["MEDAFF", "Medical Affairs", "EZ-MED"],
    ["QARA", "Quality & Regulatory Affairs", "EZ-MED"],
    ["RADOPS", "Radiopharma Operations", "EZ-RAD"],
    ["HRCOE", "HR Compensation & Governance", "EZ-HOLD"],
  ]) {
    departments[code] = await prisma.department.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code } },
      update: { name, companyId: companies[companyCode].id },
      create: { tenantId: tenant.id, code, name, companyId: companies[companyCode].id },
    });
  }

  for (const [entityType, retentionDays, action, legalBasis] of [
    ["Employee", 3650, "ANONYMIZE", "Demo: Nachweis Entgelttransparenz und HR-Dokumentationspflichten"],
    ["CompensationComponent", 3650, "REVIEW", "Demo: Verguetungsnachweis und arbeitsrechtliche Verjaehrung"],
    ["DisclosureRequest", 1095, "REVIEW", "Demo: Auskunftsvorgaenge nach Entgelttransparenz"],
    ["DisclosureResponse", 1095, "REVIEW", "Demo: Antwortnachweise und Legal Review"],
    ["ComplianceReport", 3650, "LEGAL_HOLD", "Demo: Reporting- und Auditnachweise"],
    ["Document", 3650, "REVIEW", "Demo: Dokumentenlenkung"],
    ["RecruitmentPosting", 1095, "REVIEW", "Demo: Verguetungstransparenz im Recruiting"],
    ["AiJobArchitectureDraft", 730, "DELETE", "Demo: temporaere KI-Entwurfsdaten"],
    ["AuditLog", 2190, "LEGAL_HOLD", "Demo: Sicherheits- und Compliance-Protokoll"],
  ]) {
    await prisma.retentionPolicy.upsert({
      where: { tenantId_entityType: { tenantId: tenant.id, entityType } },
      update: { retentionDays, action, legalBasis, active: true },
      create: { tenantId: tenant.id, entityType, retentionDays, action, legalBasis, active: true },
    });
  }

  const criteria = [
    ["competence", "Kompetenz", 25, "Fachwissen, Methodenkompetenz, Ausbildungsniveau", 1],
    ["responsibility", "Verantwortung", 25, "Entscheidungsumfang, Budget, Compliance-Relevanz", 2],
    ["strain", "Belastung", 20, "Zeitdruck, Komplexitaet, psychosoziale Belastung", 3],
    ["conditions", "Arbeitsbedingungen", 15, "Arbeitsumfeld, Reiseanteil, besondere Bedingungen", 4],
    ["leadership", "Fuehrung und Einfluss", 15, "Fuehrung, fachliche Steuerung, Multiplikatorrolle", 5],
  ];
  const criterionByKey = {};
  for (const [key, name, weight, description, sortOrder] of criteria) {
    criterionByKey[key] = await prisma.evaluationCriterion.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key } },
      update: { name, weight, description, sortOrder },
      create: { tenantId: tenant.id, key, name, weight, description, sortOrder },
    });
  }

  const grades = {};
  for (const [code, name, minPoints, maxPoints, sortOrder, description] of [
    ["M1", "Entry / Assistenz", 0, 24, 1, "Einstiegs- und Assistenzrollen"],
    ["M2", "Associate", 25, 39, 2, "Operative Fachrollen mit etablierten Standards"],
    ["M3", "Professional", 40, 54, 3, "Selbststaendige Fachrollen"],
    ["M4", "Senior Professional", 55, 69, 4, "Seniorige Fachrollen mit hoher Eigenverantwortung"],
    ["M5", "Lead / Expert", 70, 82, 5, "Lead- und Expertenrollen"],
    ["M6", "Head / Senior Expert", 83, 92, 6, "Bereichsleitung und Senior Expert"],
    ["M7", "Segment Leadership", 93, 100, 7, "Segment- und Geschaeftsleitung"],
  ]) {
    grades[code] = await prisma.payGrade.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code } },
      update: { name, minPoints, maxPoints, sortOrder, description },
      create: { tenantId: tenant.id, code, name, minPoints, maxPoints, sortOrder, description },
    });
  }

  for (const [code, minAmount, midAmount, maxAmount] of [
    ["M2", 4800000, 5700000, 6700000],
    ["M3", 6500000, 7800000, 9100000],
    ["M4", 7800000, 9400000, 11200000],
    ["M5", 9500000, 11800000, 14100000],
    ["M6", 12000000, 14500000, 17500000],
  ]) {
    await prisma.salaryBand.upsert({
      where: { id: `demo-band-${code}-2026` },
      update: { name: `${code} Demo Gehaltsband 2026`, minAmount, midAmount, maxAmount, validFrom: date("2026-01-01") },
      create: {
        id: `demo-band-${code}-2026`,
        tenantId: tenant.id,
        payGradeId: grades[code].id,
        name: `${code} Demo Gehaltsband 2026`,
        fullTimeHours: 40,
        minAmount,
        midAmount,
        maxAmount,
        validFrom: date("2026-01-01"),
      },
    });
  }

  const families = {};
  for (const [code, name, description] of [
    ["MED-AFFAIRS", "Medical Affairs", "Medizinisch-wissenschaftliche Schnittstellenrollen"],
    ["QA-REG", "Quality & Regulatory", "Qualitaet, Audits und regulatorische Governance"],
    ["RAD-OPS", "Radiopharma Operations", "Operative Herstellung und GMP-Betrieb"],
    ["HR-COMP", "HR Compensation", "Verguetung, HR Governance und Reporting"],
  ]) {
    families[code] = await prisma.jobFamily.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code } },
      update: { name, description },
      create: { tenantId: tenant.id, code, name, description },
    });
  }

  const comparisonGroups = {};
  for (const [code, name, description] of [
    ["MED-SENIOR-SPECIALISTS", "Medical Senior Specialists", "Seniorige Fachrollen Medical Segment"],
    ["QA-PROFESSIONALS", "QA Professionals", "Gleichwertige QA-/Regulatory-Fachrollen"],
    ["RAD-SHIFT-LEADS", "Radiopharma Shift Leads", "Operative Schicht- und GMP-Koordinationsrollen"],
    ["HR-COMP-ANALYSTS", "HR Compensation Analysts", "HR Analytics und Compensation Governance"],
  ]) {
    comparisonGroups[code] = await prisma.comparisonGroup.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code } },
      update: { name, description },
      create: { tenantId: tenant.id, code, name, description },
    });
  }

  const jobProfiles = {};
  for (const job of [
    ["MED-MSL-SENIOR", "Senior Medical Science Liaison", "MED-AFFAIRS", "M4", "MED-SENIOR-SPECIALISTS", 66],
    ["MED-MEDICAL-LEAD", "Medical Affairs Lead", "MED-AFFAIRS", "M5", "MED-SENIOR-SPECIALISTS", 78],
    ["QA-REG-MANAGER", "Regulatory Affairs Manager", "QA-REG", "M4", "QA-PROFESSIONALS", 64],
    ["RAD-SHIFT-LEAD", "Radiopharma Shift Lead", "RAD-OPS", "M3", "RAD-SHIFT-LEADS", 51],
    ["HR-COMP-ANALYST", "HR Compensation Analyst", "HR-COMP", "M3", "HR-COMP-ANALYSTS", 48],
  ]) {
    const [code, title, familyCode, gradeCode, groupCode, totalPoints] = job;
    jobProfiles[code] = await prisma.jobProfile.upsert({
      where: { tenantId_code_version: { tenantId: tenant.id, code, version: 1 } },
      update: {
        title,
        jobFamilyId: families[familyCode].id,
        payGradeId: grades[gradeCode].id,
        comparisonGroupId: comparisonGroups[groupCode].id,
        status: "APPROVED",
        totalPoints,
        validFrom: date("2026-01-01"),
      },
      create: {
        tenantId: tenant.id,
        code,
        title,
        version: 1,
        jobFamilyId: families[familyCode].id,
        payGradeId: grades[gradeCode].id,
        comparisonGroupId: comparisonGroups[groupCode].id,
        status: "APPROVED",
        totalPoints,
        validFrom: date("2026-01-01"),
        summary: `Demo-Stellenprofil fuer ${title}.`,
        responsibilities: "Objektiv beschriebene Kernaufgaben, Verantwortungsumfang und Schnittstellen.",
        requirements: "Nachweisbare Qualifikation, relevante Erfahrung und rollenspezifische Kompetenzen.",
      },
    });

    const evaluation = await prisma.jobEvaluation.upsert({
      where: { id: `demo-eval-${code}` },
      update: { totalPoints, status: "APPROVED", approvedAt: date("2026-02-15") },
      create: {
        id: `demo-eval-${code}`,
        tenantId: tenant.id,
        jobProfileId: jobProfiles[code].id,
        totalPoints,
        status: "APPROVED",
        approvedAt: date("2026-02-15"),
        notes: "Demo-Bewertung nach objektiven Kriterien.",
      },
    });
    const scores = [
      ["competence", Math.min(5, Math.max(2, Math.round(totalPoints / 18)))],
      ["responsibility", Math.min(5, Math.max(2, Math.round(totalPoints / 19)))],
      ["strain", Math.min(5, Math.max(2, Math.round(totalPoints / 22)))],
      ["conditions", 3],
      ["leadership", gradeCode === "M5" ? 5 : gradeCode === "M4" ? 3 : 2],
    ];
    for (const [criterionKey, score] of scores) {
      const criterion = criterionByKey[criterionKey];
      await prisma.jobEvaluationScore.upsert({
        where: { evaluationId_criterionId: { evaluationId: evaluation.id, criterionId: criterion.id } },
        update: { score, weighted: score * criterion.weight, evidence: "Demo-Evidenz aus Stellenbeschreibung und Review." },
        create: {
          evaluationId: evaluation.id,
          criterionId: criterion.id,
          score,
          weighted: score * criterion.weight,
          evidence: "Demo-Evidenz aus Stellenbeschreibung und Review.",
        },
      });
    }
  }

  const employees = {};
  for (const employee of [
    ["E-DEMO-2001", "Dr. Anna Beispiel", "MED-001", "FEMALE", "EZ-MED", "MED", "BER", "MEDAFF", "MED-MSL-SENIOR", "M4", 1, 40, "2022-04-01"],
    ["E-DEMO-2002", "Dr. Stefan Beispiel", "MED-002", "MALE", "EZ-MED", "MED", "BER", "MEDAFF", "MED-MSL-SENIOR", "M4", 1, 40, "2021-09-01"],
    ["E-DEMO-2003", "Dr. Maria Beispiel", "MED-003", "FEMALE", "EZ-MED", "MED", "BER", "MEDAFF", "MED-MSL-SENIOR", "M4", 0.8, 32, "2020-02-15"],
    ["E-DEMO-2004", "Thomas Beispiel", "MED-004", "MALE", "EZ-MED", "MED", "BER", "MEDAFF", "MED-MEDICAL-LEAD", "M5", 1, 40, "2019-06-01"],
    ["E-DEMO-2005", "Sabine Demo", "QA-001", "FEMALE", "EZ-MED", "MED", "BER", "QARA", "QA-REG-MANAGER", "M4", 1, 40, "2022-01-10"],
    ["E-DEMO-2006", "Markus Demo", "QA-002", "MALE", "EZ-MED", "MED", "BER", "QARA", "QA-REG-MANAGER", "M4", 1, 40, "2018-11-01"],
    ["E-DEMO-2007", "Laura Demo", "RAD-001", "FEMALE", "EZ-RAD", "RAD", "BRA", "RADOPS", "RAD-SHIFT-LEAD", "M3", 1, 40, "2023-03-01"],
    ["E-DEMO-2008", "Jens Demo", "RAD-002", "MALE", "EZ-RAD", "RAD", "BRA", "RADOPS", "RAD-SHIFT-LEAD", "M3", 1, 40, "2020-08-01"],
    ["E-DEMO-2009", "Nina Demo", "HR-001", "FEMALE", "EZ-HOLD", "CORP", "HQ", "HRCOE", "HR-COMP-ANALYST", "M3", 1, 40, "2024-01-01"],
    ["E-DEMO-2010", "Omar Demo", "HR-002", "MALE", "EZ-HOLD", "CORP", "HQ", "HRCOE", "HR-COMP-ANALYST", "M3", 1, 40, "2023-07-01"],
  ]) {
    const [employeeNumber, displayName, pseudonym, gender, companyCode, segmentCode, siteCode, departmentCode, jobCode, gradeCode, fte, weeklyHours, hiredAt] = employee;
    employees[employeeNumber] = await prisma.employee.upsert({
      where: { tenantId_employeeNumber: { tenantId: tenant.id, employeeNumber } },
      update: {
        displayName,
        pseudonym,
        gender,
        status: "ACTIVE",
        companyId: companies[companyCode].id,
        segmentId: segments[segmentCode].id,
        siteId: sites[siteCode].id,
        departmentId: departments[departmentCode].id,
        jobProfileId: jobProfiles[jobCode].id,
        payGradeId: grades[gradeCode].id,
        fte,
        weeklyHours,
        fullTimeHours: 40,
        hiredAt: date(hiredAt),
      },
      create: {
        tenantId: tenant.id,
        employeeNumber,
        displayName,
        pseudonym,
        gender,
        status: "ACTIVE",
        companyId: companies[companyCode].id,
        segmentId: segments[segmentCode].id,
        siteId: sites[siteCode].id,
        departmentId: departments[departmentCode].id,
        jobProfileId: jobProfiles[jobCode].id,
        payGradeId: grades[gradeCode].id,
        fte,
        weeklyHours,
        fullTimeHours: 40,
        hiredAt: date(hiredAt),
      },
    });
  }

  for (const item of [
    ["demo-comp-2001-base", "E-DEMO-2001", "BASE_SALARY", "Jahresgrundgehalt", 9000000, "APPROVED", "Medical Compensation Governance", "Marktkonforme Senioritaet, keine Abweichung zum Band"],
    ["demo-comp-2002-base", "E-DEMO-2002", "BASE_SALARY", "Jahresgrundgehalt", 10100000, "APPROVED", "Medical Compensation Governance", "Laengere einschlaegige Erfahrung und Lead-Projekte"],
    ["demo-comp-2003-base", "E-DEMO-2003", "BASE_SALARY", "Jahresgrundgehalt", 7400000, "APPROVED", "Medical Compensation Governance", "Teilzeit-FTE, Betrag als Ist-Verguetung im System"],
    ["demo-comp-2004-base", "E-DEMO-2004", "BASE_SALARY", "Jahresgrundgehalt", 11900000, "PENDING", "Medical Compensation Governance", "Lead-Rolle M5, Freigabe noch offen"],
    ["demo-comp-2005-base", "E-DEMO-2005", "BASE_SALARY", "Jahresgrundgehalt", 8800000, "APPROVED", "QA Compensation Governance", "Regulatory Erfahrung"],
    ["demo-comp-2006-base", "E-DEMO-2006", "BASE_SALARY", "Jahresgrundgehalt", 9700000, "APPROVED", "QA Compensation Governance", "Audit Lead Erfahrung und objektive Projektverantwortung"],
    ["demo-comp-2007-base", "E-DEMO-2007", "BASE_SALARY", "Jahresgrundgehalt", 7600000, "APPROVED", "Radiopharma Operations Band", "Schichtkoordination und GMP-Erfahrung"],
    ["demo-comp-2008-base", "E-DEMO-2008", "BASE_SALARY", "Jahresgrundgehalt", 8100000, "APPROVED", "Radiopharma Operations Band", "Langjaehrige Schichtleitung"],
    ["demo-comp-2009-base", "E-DEMO-2009", "BASE_SALARY", "Jahresgrundgehalt", 6900000, "APPROVED", "Corporate HR Band", "Neue Rolle im Band M3"],
    ["demo-comp-2010-base", "E-DEMO-2010", "BASE_SALARY", "Jahresgrundgehalt", 7700000, "APPROVED", "Corporate HR Band", "Analytics-Erfahrung und Projektverantwortung"],
    ["demo-comp-2002-bonus", "E-DEMO-2002", "BONUS", "Zielbonus 2026", 800000, "PENDING", "Bonus Policy 2026", "Projektbezogene Zielvereinbarung"],
    ["demo-comp-2007-allowance", "E-DEMO-2007", "ALLOWANCE", "Schichtzulage", 360000, "APPROVED", "Betriebsvereinbarung Schichtzulage", "Objektive Schichtarbeit"],
  ]) {
    const [id, employeeNumber, type, label, amountCents, approvalStatus, legalBasis, objectiveReason] = item;
    await upsertCompensation({
      id,
      tenantId: tenant.id,
      employeeId: employees[employeeNumber].id,
      type,
      label,
      amountCents,
      approvalStatus,
      legalBasis,
      objectiveReason,
      validFrom: date("2026-01-01"),
    });
  }

  const analysis = await prisma.payGapAnalysis.upsert({
    where: { id: "demo-paygap-2026-q2" },
    update: {
      name: "Demo Dry Run Entgelttransparenz Q2 2026",
      dataCutDate: date("2026-06-30"),
      scopeJson: { segment: "Medical und Konzernfunktionen", demo: true },
    },
    create: {
      id: "demo-paygap-2026-q2",
      tenantId: tenant.id,
      name: "Demo Dry Run Entgelttransparenz Q2 2026",
      dataCutDate: date("2026-06-30"),
      createdById: compManager.id,
      scopeJson: { segment: "Medical und Konzernfunktionen", demo: true },
    },
  });

  const payGapRows = {};
  for (const row of [
    ["demo-gap-med-senior", "MED-SENIOR-SPECIALISTS", "Medical Senior Specialists", 4, 2, 2, 6.8, 5.9, true, true, "Berufserfahrung und Projektverantwortung teilweise dokumentiert", "Objektivgruende pruefen und Bandposition dokumentieren"],
    ["demo-gap-qa", "QA-PROFESSIONALS", "QA Professionals", 2, 1, 1, 4.2, 3.9, false, false, "Audit Lead Erfahrung dokumentiert", "Keine Massnahme erforderlich"],
    ["demo-gap-rad", "RAD-SHIFT-LEADS", "Radiopharma Shift Leads", 2, 1, 1, 3.1, 2.7, false, false, "Schichtzulagen transparent ausgewiesen", "Monitoring im naechsten Dry Run"],
    ["demo-gap-hr", "HR-COMP-ANALYSTS", "HR Compensation Analysts", 2, 1, 1, 7.4, 6.5, true, true, "Markteintritt und Analytics-Erfahrung unvollstaendig dokumentiert", "Verguetungsentscheidung und Entwicklungsplan reviewen"],
  ]) {
    const [id, groupKey, groupLabel, employeeCount, femaleCount, maleCount, averageGapPercent, medianGapPercent, unexplainedGap, triggerFivePercent, objectiveReason, remediationPlan] = row;
    payGapRows[groupKey] = await prisma.payGapAnalysisRow.upsert({
      where: { id },
      update: { employeeCount, femaleCount, maleCount, averageGapPercent, medianGapPercent, unexplainedGap, triggerFivePercent, objectiveReason, remediationPlan },
      create: { id, analysisId: analysis.id, groupKey, groupLabel, employeeCount, femaleCount, maleCount, averageGapPercent, medianGapPercent, unexplainedGap, triggerFivePercent, objectiveReason, remediationPlan },
    });
  }

  for (const item of [
    ["demo-remed-med-senior", payGapRows["MED-SENIOR-SPECIALISTS"].id, "Bandposition Medical Senior Specialists pruefen", "Objektivgruende fuer >5 Prozent Gap nachdokumentieren und ggf. Anpassung vorschlagen.", "Uneinheitliche Dokumentation von Projekterfahrung", "Erfahrung, Marktknappheit und Lead-Verantwortung", compManager.id, "2026-09-30", "IN_PROGRESS"],
    ["demo-remed-hr-analysts", payGapRows["HR-COMP-ANALYSTS"].id, "HR Compensation Analyst Vergleichsgruppe reviewen", "Verguetungsentscheidung und Entwicklungsplan in HR Governance Board pruefen.", "Bandposition neuer Rolle noch nicht stabilisiert", "Analytics-Senioritaet und Einfuehrungsphase", hrAdmin.id, "2026-08-31", "OPEN"],
  ]) {
    const [id, payGapRowId, title, description, rootCause, objectiveReason, ownerUserId, dueAt, status] = item;
    await prisma.remediationAction.upsert({
      where: { id },
      update: { title, description, rootCause, objectiveReason, ownerUserId, dueAt: date(dueAt), status },
      create: { id, tenantId: tenant.id, payGapRowId, title, description, rootCause, objectiveReason, ownerUserId, dueAt: date(dueAt), status },
    });
  }

  const disclosureRequest = await prisma.disclosureRequest.upsert({
    where: { id: "demo-disclosure-med-001" },
    update: {
      employeeId: employees["E-DEMO-2001"].id,
      status: "IN_REVIEW",
      requesterLabel: "MED-001",
      comparisonGroup: "MED-SENIOR-SPECIALISTS",
      dueAt: date("2026-08-31"),
      notes: "Demo-Auskunftsvorgang mit Legal Review.",
    },
    create: {
      id: "demo-disclosure-med-001",
      tenantId: tenant.id,
      employeeId: employees["E-DEMO-2001"].id,
      status: "IN_REVIEW",
      requesterLabel: "MED-001",
      comparisonGroup: "MED-SENIOR-SPECIALISTS",
      receivedAt: date("2026-07-15"),
      dueAt: date("2026-08-31"),
      notes: "Demo-Auskunftsvorgang mit Legal Review.",
    },
  });
  await prisma.disclosureResponse.upsert({
    where: { id: "demo-response-med-001" },
    update: {
      employeeId: employees["E-DEMO-2001"].id,
      comparisonGroup: "MED-SENIOR-SPECIALISTS",
      comparisonEmployeeCount: 4,
      averagePayFemale: 8200000,
      averagePayMale: 11000000,
      medianPayFemale: 9000000,
      medianPayMale: 10100000,
      answerText: "Demo-Antwort: Vergleichsgruppe Medical Senior Specialists; objektive Gruende werden vor Auslieferung final geprueft.",
      legalReviewRequired: true,
    },
    create: {
      id: "demo-response-med-001",
      tenantId: tenant.id,
      disclosureRequestId: disclosureRequest.id,
      employeeId: employees["E-DEMO-2001"].id,
      generatedById: legal.id,
      employeePayAmountCipher: encryptField("9000000", `${tenant.id}:${employees["E-DEMO-2001"].id}:DISCLOSURE`),
      employeePayKeyId: KEY_ID,
      comparisonGroup: "MED-SENIOR-SPECIALISTS",
      comparisonEmployeeCount: 4,
      averagePayFemale: 8200000,
      averagePayMale: 11000000,
      medianPayFemale: 9000000,
      medianPayMale: 10100000,
      answerText: "Demo-Antwort: Vergleichsgruppe Medical Senior Specialists; objektive Gruende werden vor Auslieferung final geprueft.",
      legalReviewRequired: true,
    },
  });

  await prisma.disclosureRequest.upsert({
    where: { id: "demo-disclosure-answered-qa" },
    update: { status: "ANSWERED", responseDocument: "Demo-Antwortschreiben QA-001.pdf", dueAt: date("2026-07-30") },
    create: {
      id: "demo-disclosure-answered-qa",
      tenantId: tenant.id,
      employeeId: employees["E-DEMO-2005"].id,
      requesterLabel: "QA-001",
      status: "ANSWERED",
      comparisonGroup: "QA-PROFESSIONALS",
      responseDocument: "Demo-Antwortschreiben QA-001.pdf",
      receivedAt: date("2026-06-12"),
      dueAt: date("2026-07-30"),
      notes: "Demo: abgeschlossener Auskunftsvorgang.",
    },
  });

  const report = await prisma.complianceReport.upsert({
    where: { id: "demo-report-paygap-2026-q2" },
    update: {
      status: "GENERATED",
      rowCount: 4,
      findingsJson: { triggerGroups: 2, nextActions: ["Legal Review", "Remediation Tracking"], demo: true },
    },
    create: {
      id: "demo-report-paygap-2026-q2",
      tenantId: tenant.id,
      type: "INTERNAL_DRY_RUN",
      status: "GENERATED",
      name: "Demo interner Pay-Gap-Dry-Run Q2 2026",
      periodStart: date("2026-01-01"),
      periodEnd: date("2026-06-30"),
      generatedById: compManager.id,
      payGapAnalysisId: analysis.id,
      rowCount: 4,
      exportFormat: "CSV",
      exportChecksumSha256: contentHash("demo-report-paygap-2026-q2"),
      findingsJson: { triggerGroups: 2, nextActions: ["Legal Review", "Remediation Tracking"], demo: true },
    },
  });

  for (const item of [
    ["demo-report-article9", "ARTICLE_9_PAY_GAP", "DRAFT", "Demo Bericht Artikel 9 Vorbereitung 2026", "2026-01-01", "2026-12-31"],
    ["demo-report-remediation", "REMEDIATION_STATUS", "APPROVED", "Demo Massnahmenstatus September 2026", "2026-07-01", "2026-09-30"],
    ["demo-report-disclosure", "DISCLOSURE_RESPONSE", "GENERATED", "Demo Auskunftsantwort MED-001", "2026-07-01", "2026-08-31"],
  ]) {
    const [id, type, status, name, periodStart, periodEnd] = item;
    await prisma.complianceReport.upsert({
      where: { id },
      update: { type, status, name, periodStart: date(periodStart), periodEnd: date(periodEnd), rowCount: 1 },
      create: { id, tenantId: tenant.id, type, status, name, periodStart: date(periodStart), periodEnd: date(periodEnd), generatedById: hrAdmin.id, rowCount: 1, findingsJson: { demo: true } },
    });
  }

  const documents = [];
  for (const item of [
    {
      id: "demo-doc-comp-policy",
      title: "Demo Compensation Governance Policy",
      type: "POLICY",
      sensitivity: "HR_STRUCTURAL",
      fileName: "demo-compensation-governance.md",
      mimeType: "text/markdown",
      content: "# Demo Compensation Governance\n\nObjektive Stellenbewertung, Gehaltsbaender und dokumentierte Abweichungsgruende.",
    },
    {
      id: "demo-doc-works-agreement",
      title: "Demo Betriebsvereinbarung Entgelttransparenz",
      type: "WORKS_AGREEMENT",
      sensitivity: "LEGAL_CONFIDENTIAL",
      fileName: "demo-bv-entgelttransparenz.md",
      mimeType: "text/markdown",
      content: "# Demo BV\n\nProzess zur Rollenbewertung, Gehaltsbandpflege, Auskunft und Review.",
    },
    {
      id: "demo-doc-report-q2",
      title: "Demo Pay-Gap-Dry-Run Q2 2026",
      type: "REPORT",
      sensitivity: "PAY_ANALYTICS",
      fileName: "demo-pay-gap-q2-2026.csv",
      mimeType: "text/csv",
      content: "gruppe,count,gap,trigger\nMED-SENIOR-SPECIALISTS,4,6.8,true\nHR-COMP-ANALYSTS,2,7.4,true\n",
    },
    {
      id: "demo-doc-job-template",
      title: "Demo Vorlage Stellenbeschreibung KI Assistant",
      type: "TEMPLATE",
      sensitivity: "HR_STRUCTURAL",
      fileName: "demo-job-description-template.md",
      mimeType: "text/markdown",
      content: "# Demo Stellenbeschreibung\n\nAufgaben, Verantwortung, Anforderungen, Schnittstellen, Arbeitsbedingungen.",
    },
  ]) {
    documents.push(await upsertDocument(tenant.id, hrAdmin.id, item));
  }

  for (const item of [
    ["demo-recruiting-med-lead", "MED-MEDICAL-LEAD", "Medical Affairs Lead", "Berlin", "PUBLISHED", 9500000, 14100000, "Die Rolle ist dem Band M5 zugeordnet; konkrete Einordnung erfolgt nach objektiver Erfahrung und Verantwortung.", true, true, "2026-07-01"],
    ["demo-recruiting-qa-manager", "QA-REG-MANAGER", "Regulatory Affairs Manager", "Berlin", "APPROVED", 7800000, 11200000, "Die Verguetung liegt im Band M4 entsprechend Stellenbewertung und regulatorischer Erfahrung.", true, true, null],
    ["demo-recruiting-rad-shift", "RAD-SHIFT-LEAD", "Radiopharma Shift Lead", "Braunschweig", "DRAFT", 6500000, 9100000, "Demo-Entwurf mit transparentem Band M3; Veroeffentlichung nach HR Review.", true, true, null],
  ]) {
    const [id, jobCode, title, location, status, salaryMinAmount, salaryMaxAmount, payTransparencyText, genderNeutralCheck, priorPayQuestionBan, publishedAt] = item;
    await prisma.recruitmentPosting.upsert({
      where: { id },
      update: { jobProfileId: jobProfiles[jobCode].id, title, location, status, salaryMinAmount, salaryMaxAmount, payTransparencyText, genderNeutralCheck, priorPayQuestionBan, publishedAt: publishedAt ? date(publishedAt) : null },
      create: { id, tenantId: tenant.id, jobProfileId: jobProfiles[jobCode].id, title, location, status, salaryMinAmount, salaryMaxAmount, currency: "EUR", payTransparencyText, genderNeutralCheck, priorPayQuestionBan, publishedAt: publishedAt ? date(publishedAt) : null },
    });
  }

  const prompt = await prisma.aiJobPromptVersion.upsert({
    where: { tenantId_version: { tenantId: tenant.id, version: "demo-v1" } },
    update: { active: true, name: "Demo Prompt Job Architecture Assistant" },
    create: {
      tenantId: tenant.id,
      version: "demo-v1",
      name: "Demo Prompt Job Architecture Assistant",
      systemPrompt: "Demo-Prompt: Analysiere Stellenbeschreibungen lokal, ohne externe KI-Anbindung, und liefere nur pruefbare Entwurfsdaten.",
      outputSchema: { demo: true, required: ["suggestedTitle", "suggestedGradeCode", "missingInformation"] },
      active: true,
      createdById: hrAdmin.id,
    },
  });

  for (const item of [
    ["demo-ai-draft-mra", "Demo_Stellenbeschreibung_Medical_Reviewer.pdf", "Medical Reviewer", "MED-MEDICAL-REVIEWER", "Medical Affairs", "MED-SENIOR-SPECIALISTS", "M4", 63, "NEEDS_REVIEW"],
    ["demo-ai-draft-hr", "Demo_Stellenbeschreibung_HR_Analytics.docx", "HR Compensation Analyst", "HR-COMP-ANALYST", "HR Compensation", "HR-COMP-ANALYSTS", "M3", 48, "TRANSFERRED"],
  ]) {
    const [id, sourceFileName, suggestedTitle, suggestedCode, suggestedJobFamily, suggestedComparisonGroup, suggestedGradeCode, suggestedTotalPoints, status] = item;
    const extractedText = `Demo-Stellenbeschreibung fuer ${suggestedTitle}. Aufgaben, Verantwortung, Anforderungen und Arbeitsbedingungen wurden lokal extrahiert.`;
    await prisma.aiJobArchitectureDraft.upsert({
      where: { id },
      update: {
        status,
        suggestedTitle,
        suggestedCode,
        suggestedJobFamily,
        suggestedComparisonGroup,
        suggestedGradeCode,
        suggestedTotalPoints,
        confidence: 0.78,
        reviewerNotes: status === "TRANSFERRED" ? "Demo: bereits in Jobarchitektur ueberfuehrt." : "Demo: Review erforderlich.",
      },
      create: {
        id,
        tenantId: tenant.id,
        promptVersionId: prompt.id,
        sourceFileName,
        sourceMimeType: sourceFileName.endsWith(".pdf") ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        sourceSizeBytes: 42000,
        sourceChecksumSha256: contentHash(sourceFileName),
        businessUnit: "Medical Segment",
        companyCode: "EZ-MED",
        sourceLanguage: "de",
        extractedTextCipher: encryptField(extractedText, `${tenant.id}:${id}:ai-draft`),
        extractedTextKeyId: KEY_ID,
        redactionSummary: { personalDataRemoved: true, payDataFound: false, demo: true },
        status,
        promptHashSha256: contentHash(prompt.systemPrompt),
        analysisJson: { criteria: ["competence", "responsibility", "conditions"], demo: true },
        suggestedTitle,
        suggestedCode,
        suggestedJobFamily,
        suggestedComparisonGroup,
        suggestedGradeCode,
        suggestedTotalPoints,
        confidence: 0.78,
        missingInformation: ["Finale Fuehrungsverantwortung pruefen", "Budgetverantwortung bestaetigen"],
        biasWarnings: ["Keine geschlechtsbezogenen Kriterien verwenden", "Senioritaet nur anhand objektiver Evidenz bewerten"],
        reviewerNotes: status === "TRANSFERRED" ? "Demo: bereits in Jobarchitektur ueberfuehrt." : "Demo: Review erforderlich.",
        reviewedById: status === "TRANSFERRED" ? hrAdmin.id : null,
        reviewedAt: status === "TRANSFERRED" ? date("2026-07-10") : null,
        transferredJobProfileId: status === "TRANSFERRED" ? jobProfiles["HR-COMP-ANALYST"].id : null,
        createdById: importer.id,
      },
    });
  }

  const workflow = await prisma.approvalWorkflow.upsert({
    where: { id: "demo-workflow-comp-2004" },
    update: { entityType: "CompensationComponent", entityId: "demo-comp-2004-base", status: "PENDING" },
    create: { id: "demo-workflow-comp-2004", tenantId: tenant.id, entityType: "CompensationComponent", entityId: "demo-comp-2004-base", status: "PENDING" },
  });
  for (const [id, approverId, status, comment, decidedAt] of [
    ["demo-step-comp-hr", hrAdmin.id, "APPROVED", "Demo HR Review abgeschlossen.", "2026-07-16"],
    ["demo-step-comp-legal", legal.id, "PENDING", null, null],
    ["demo-step-comp-br", worksCouncil.id, "PENDING", null, null],
  ]) {
    await prisma.approvalStep.upsert({
      where: { id },
      update: { approverId, status, comment, decidedAt: decidedAt ? date(decidedAt) : null },
      create: { id, workflowId: workflow.id, approverId, status, comment, decidedAt: decidedAt ? date(decidedAt) : null },
    });
  }

  const reportWorkflow = await prisma.approvalWorkflow.upsert({
    where: { id: "demo-workflow-report-q2" },
    update: { entityType: "ComplianceReport", entityId: report.id, status: "PENDING" },
    create: { id: "demo-workflow-report-q2", tenantId: tenant.id, entityType: "ComplianceReport", entityId: report.id, status: "PENDING" },
  });
  await prisma.approvalStep.upsert({
    where: { id: "demo-step-report-audit" },
    update: { approverId: auditor.id, status: "PENDING", comment: null, decidedAt: null },
    create: { id: "demo-step-report-audit", workflowId: reportWorkflow.id, approverId: auditor.id, status: "PENDING" },
  });

  for (const item of [
    ["demo-import-employees-july", "employees", "demo-mitarbeiter-import-juli.csv", 10, 10, 0, "COMPLETED", importer.id, "2026-07-12"],
    ["demo-import-job-descriptions", "job-descriptions", "demo-stellenbeschreibungen-medical.zip", 2, 1, 1, "COMPLETED_WITH_WARNINGS", importer.id, "2026-07-13"],
  ]) {
    const [id, type, fileName, rowCount, acceptedCount, rejectedCount, status, createdById, completedAt] = item;
    await prisma.importBatch.upsert({
      where: { id },
      update: { type, fileName, rowCount, acceptedCount, rejectedCount, status, completedAt: date(completedAt), createdById },
      create: { id, tenantId: tenant.id, type, fileName, rowCount, acceptedCount, rejectedCount, status, completedAt: date(completedAt), createdById },
    });
  }

  const moduleContent = "Demo-Onboarding: Datenschutz, Rollenmodell, Verguetungsdatenzugriff und Auditpflichten im Testsystem.";
  const onboardingModule = await prisma.onboardingModule.upsert({
    where: { tenantId_key_version: { tenantId: tenant.id, key: "demo-sensitive-data-handling", version: 1 } },
    update: { title: "Demo Umgang mit sensiblen Verguetungsdaten", content: moduleContent, contentHash: contentHash(moduleContent), active: true },
    create: {
      tenantId: tenant.id,
      key: "demo-sensitive-data-handling",
      version: 1,
      title: "Demo Umgang mit sensiblen Verguetungsdaten",
      objective: "Anwender kennen Rollen, Zugriff, Vertraulichkeit und Audit-Trails.",
      content: moduleContent,
      contentHash: contentHash(moduleContent),
      estimatedMinutes: 8,
      sortOrder: 90,
      applicableRoles: ["HR_ADMIN", "COMPENSATION_MANAGER", "HR_ANALYST", "AUDITOR"],
      required: true,
      active: true,
    },
  });
  for (const user of [hrAdmin, compManager, auditor]) {
    await prisma.onboardingCompletion.upsert({
      where: {
        tenantId_userId_moduleKey_moduleVersion: {
          tenantId: tenant.id,
          userId: user.id,
          moduleKey: onboardingModule.key,
          moduleVersion: onboardingModule.version,
        },
      },
      update: { attestationText: "Demo-Bestaetigung fuer Testsystem.", completedAt: date("2026-07-14") },
      create: {
        tenantId: tenant.id,
        userId: user.id,
        moduleId: onboardingModule.id,
        moduleKey: onboardingModule.key,
        moduleVersion: onboardingModule.version,
        attestationText: "Demo-Bestaetigung fuer Testsystem.",
        completedAt: date("2026-07-14"),
      },
    });
  }

  for (const [action, entityType, entityId, severity, metadata] of [
    ["demo.seed.completed", "Tenant", tenant.id, "INFO", { demoPassword: DEMO_PASSWORD }],
    ["demo.paygap.review.required", "PayGapAnalysis", analysis.id, "WARNING", { triggerGroups: 2 }],
    ["demo.compensation.approval.pending", "CompensationComponent", "demo-comp-2004-base", "WARNING", { workflowId: workflow.id }],
    ["demo.document.loaded", "Document", documents[0].id, "INFO", { count: documents.length }],
  ]) {
    await prisma.auditLog.create({
      data: { tenantId: tenant.id, userId: admin?.id || hrAdmin.id, action, entityType, entityId, severity, metadata },
    });
  }

  console.log("Demo data seed completed.");
  console.log("Demo users use password: DemoEZAG2026!");
  console.log("Primary demo users:");
  console.log("- demo.hr-admin@easybrainlab.com");
  console.log("- demo.compensation@easybrainlab.com");
  console.log("- demo.legal@easybrainlab.com");
  console.log("- demo.audit@easybrainlab.com");
  console.log("Demo employees:", Object.keys(employees).length);
  console.log("Demo job profiles:", Object.keys(jobProfiles).length);
  console.log("Demo documents:", documents.length);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
