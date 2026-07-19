const { PrismaClient } = require("@prisma/client");
const { randomBytes, scrypt, timingSafeEqual } = require("node:crypto");
const { promisify } = require("node:util");

const prisma = new PrismaClient();
const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

async function hashPassword(password) {
  const salt = randomBytes(16).toString("base64url");
  const derived = await scryptAsync(password, salt, KEY_LENGTH);
  return `scrypt-v1$${salt}$${derived.toString("base64url")}`;
}

async function verifyPassword(password, stored) {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt-v1" || !salt || !hash) return false;
  const derived = await scryptAsync(password, salt, KEY_LENGTH);
  const expected = Buffer.from(hash, "base64url");
  if (expected.length !== derived.length) return false;
  return timingSafeEqual(expected, derived);
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function ensureRole(tenantId, userId, role) {
  const existing = await prisma.roleAssignment.findFirst({
    where: { tenantId, userId, role },
  });
  if (existing) return;

  await prisma.roleAssignment.create({
    data: { tenantId, userId, role },
  });
}

async function main() {
  const email = requireEnv("BOOTSTRAP_ADMIN_EMAIL").trim().toLowerCase();
  const password = requireEnv("BOOTSTRAP_ADMIN_PASSWORD");
  const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || "Bootstrap Admin";
  const roles = (process.env.BOOTSTRAP_ADMIN_ROLES || "SYSTEM_ADMIN,HR_ADMIN,SECURITY_ADMIN")
    .split(",")
    .map((role) => role.trim())
    .filter(Boolean);

  if (!email.includes("@")) throw new Error("BOOTSTRAP_ADMIN_EMAIL must be a valid email address.");
  if (password.length < 12) throw new Error("BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters.");
  if (!roles.length) throw new Error("At least one role is required.");

  const tenant = await prisma.tenant.upsert({
    where: { slug: "ezag" },
    update: {},
    create: { name: "Eckert & Ziegler", slug: "ezag" },
  });

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email } },
    update: {
      name,
      authProvider: "LOCAL",
      passwordHash,
      status: "ACTIVE",
      mfaRequired: false,
    },
    create: {
      tenantId: tenant.id,
      email,
      name,
      authProvider: "LOCAL",
      passwordHash,
      status: "ACTIVE",
      mfaRequired: false,
    },
  });

  for (const role of roles) {
    await ensureRole(tenant.id, user.id, role);
  }

  await prisma.session.deleteMany({ where: { userId: user.id } });

  const reloaded = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    include: { roles: true },
  });
  const passwordWorks = await verifyPassword(password, reloaded.passwordHash);
  if (!passwordWorks) throw new Error("Password verification failed after admin bootstrap.");

  await prisma.auditLog.create({
    data: {
      tenantId: tenant.id,
      userId: user.id,
      action: "bootstrap.admin.upsert",
      entityType: "User",
      entityId: user.id,
      severity: "WARNING",
      metadata: { email, roles },
    },
  });

  console.log(`Bootstrap admin ready: ${email}`);
  console.log(`Status: ${reloaded.status}`);
  console.log(`Auth provider: ${reloaded.authProvider}`);
  console.log(`MFA required: ${reloaded.mfaRequired}`);
  console.log(`Password verification: ${passwordWorks ? "ok" : "failed"}`);
  console.log(`Sessions cleared: yes`);
  console.log(`Roles: ${reloaded.roles.map((role) => role.role).sort().join(", ")}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
