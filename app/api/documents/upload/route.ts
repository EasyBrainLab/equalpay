import { createHash } from "node:crypto";
import type { DataSensitivity, DocumentType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { encryptField } from "@/lib/security/crypto";
import { badRequest, forbidden, ok, unauthorized } from "@/lib/server/api";
import { requirePermission } from "@/lib/server/context";
import { writeAuditLog } from "@/lib/server/audit";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const DOCUMENT_TYPES = new Set(["POLICY", "WORKS_AGREEMENT", "JOB_PROFILE", "LEGAL_MEMO", "REPORT", "OFFER", "TEMPLATE", "OTHER"]);
const SENSITIVITIES = new Set(["PUBLIC_CONFIG", "HR_STRUCTURAL", "PERSONAL_BASIC", "PERSONAL_SENSITIVE", "PAY_SENSITIVE", "PAY_ANALYTICS", "LEGAL_CONFIDENTIAL", "SECURITY"]);

export async function POST(request: Request) {
  const { ctx, error } = await requirePermission("documents:edit");
  if (error === "unauthorized") return unauthorized();
  if (error === "forbidden") return forbidden();

  const form = await request.formData();
  const title = String(form.get("title") ?? "").trim();
  const type = String(form.get("type") ?? "OTHER");
  const sensitivity = String(form.get("sensitivity") ?? "HR_STRUCTURAL");
  const file = form.get("file");

  if (!title) return badRequest("Dokumenttitel fehlt.");
  if (!DOCUMENT_TYPES.has(type)) return badRequest("Dokumenttyp ist ungueltig.");
  if (!SENSITIVITIES.has(sensitivity)) return badRequest("Sensitivitaet ist ungueltig.");
  if (!(file instanceof File)) return badRequest("Datei fehlt.");
  if (file.size <= 0) return badRequest("Datei ist leer.");
  if (file.size > MAX_UPLOAD_BYTES) return badRequest("Datei ist groesser als 10 MB.");

  const bytes = Buffer.from(await file.arrayBuffer());
  const checksumSha256 = createHash("sha256").update(bytes).digest("hex");
  const document = await prisma.document.create({
    data: {
      tenantId: ctx.tenantId,
      title,
      type: type as DocumentType,
      sensitivity: sensitivity as DataSensitivity,
      versions: {
        create: {
          version: 1,
          fileName: file.name || "upload.bin",
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          storageKey: `db://${ctx.tenantId}/${checksumSha256}`,
          contentCipher: encryptField(bytes.toString("base64"), `${ctx.tenantId}:${checksumSha256}`).ciphertext,
          encryptionKeyId: "local-master-key-v1",
          checksumSha256,
          uploadedByUserId: ctx.user.id,
        },
      },
    },
    include: { versions: true },
  });

  await writeAuditLog({
    tenantId: ctx.tenantId,
    userId: ctx.user.id,
    action: "document.upload",
    entityType: "Document",
    entityId: document.id,
    severity: sensitivity.includes("PAY") || sensitivity.includes("LEGAL") ? "WARNING" : "INFO",
    metadata: { fileName: file.name, sizeBytes: file.size, sensitivity, checksumSha256 },
  });

  return ok({ documentId: document.id, versionId: document.versions[0]?.id });
}
