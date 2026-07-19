import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { RoleKey, Session, User } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { env, isProd } from "@/lib/env";
import { writeAuditLog } from "@/lib/server/audit";

export const SESSION_COOKIE = "ez_pay_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 10;

export type AuthSession = {
  session: Session;
  user: User;
  roles: RoleKey[];
  tenantId: string;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

function createToken(): string {
  return randomBytes(32).toString("base64url");
}

function cookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProd,
    path: "/",
    expires: expiresAt,
  };
}

export async function createSession(userId: string): Promise<void> {
  const token = createToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const h = await headers();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt,
      ipAddress: h.get("x-forwarded-for"),
      userAgent: h.get("user-agent"),
    },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, cookieOptions(expiresAt));
  await writeAuditLog({
    tenantId: user.tenantId,
    userId,
    action: "auth.session.create",
    ipAddress: h.get("x-forwarded-for"),
    userAgent: h.get("user-agent"),
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  store.delete(SESSION_COOKIE);
}

export const getAuthSession = cache(async (): Promise<AuthSession | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { roles: true } } },
  });
  if (!session || session.expiresAt.getTime() < Date.now() || session.user.status !== "ACTIVE") {
    return null;
  }
  await prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  const { user, ...rest } = session;
  return {
    session: rest as Session,
    user,
    roles: user.roles.map((role) => role.role),
    tenantId: user.tenantId,
  };
});

export async function requireAuth(): Promise<AuthSession> {
  const session = await getAuthSession();
  if (!session) redirect("/login");
  return session;
}

export function azureAuthConfigured(): boolean {
  return Boolean(env.AZURE_AD_TENANT_ID && env.AZURE_AD_CLIENT_ID && env.AZURE_AD_CLIENT_SECRET);
}
