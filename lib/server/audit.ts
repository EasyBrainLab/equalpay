import type { AuditSeverity } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export async function writeAuditLog(input: {
  tenantId?: string | null;
  userId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  severity?: AuditSeverity;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  await prisma.auditLog.create({
    data: {
      tenantId: input.tenantId ?? null,
      userId: input.userId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      severity: input.severity ?? "INFO",
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    },
  });
}
