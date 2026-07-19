import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { readJson, ok, unauthorized } from "@/lib/server/api";
import { verifyPassword } from "@/lib/security/password";
import { checkRateLimit, resetRateLimit } from "@/lib/security/rate-limit";
import { createSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/server/audit";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const DUMMY_HASH =
  "scrypt-v1$MDAwMDAwMDAwMDAwMDAwMA$MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMA";

export async function POST(request: Request) {
  const input = await readJson(request, loginSchema);
  const ipAddress = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? "unknown";
  const rateLimitKey = `login:${ipAddress}:${input.email.toLowerCase()}`;
  const rate = checkRateLimit(rateLimitKey, 8, 15 * 60 * 1000);
  if (!rate.allowed) {
    return unauthorized(`Zu viele fehlgeschlagene Login-Versuche. Bitte in ${rate.retryAfterSeconds} Sekunden erneut versuchen.`);
  }
  const user = await prisma.user.findFirst({
    where: { email: input.email.toLowerCase(), status: "ACTIVE" },
    include: { roles: true },
  });
  if (!user?.passwordHash) {
    await verifyPassword(input.password, DUMMY_HASH).catch(() => false);
    return unauthorized("E-Mail-Adresse oder Passwort ist falsch.");
  }
  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) return unauthorized("E-Mail-Adresse oder Passwort ist falsch.");
  resetRateLimit(rateLimitKey);
  await createSession(user.id);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await writeAuditLog({ tenantId: user.tenantId, userId: user.id, action: "auth.login" });
  return ok({ ok: true, userId: user.id });
}
