import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

const ALGORITHM = "aes-256-gcm";
const KEY_ID = "local-master-key-v1";

function getMasterKey(): Buffer {
  if (env.FIELD_ENCRYPTION_MASTER_KEY_B64) {
    const key = Buffer.from(env.FIELD_ENCRYPTION_MASTER_KEY_B64, "base64");
    if (key.length === 32) return key;
  }
  if (env.NODE_ENV === "production") {
    throw new Error("FIELD_ENCRYPTION_MASTER_KEY_B64 must be a 32-byte base64 key in production.");
  }
  return createHash("sha256").update("dev-only-pay-transparency-master-key").digest();
}

export type EncryptedValue = {
  ciphertext: string;
  keyId: string;
  algorithm: string;
};

export function encryptField(plainText: string, aad?: string): EncryptedValue {
  const key = getMasterKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  if (aad) cipher.setAAD(Buffer.from(aad));
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: Buffer.concat([iv, tag, encrypted]).toString("base64url"),
    keyId: KEY_ID,
    algorithm: ALGORITHM,
  };
}

export function decryptField(value: EncryptedValue, aad?: string): string {
  if (value.algorithm !== ALGORITHM) throw new Error(`Unsupported encryption algorithm: ${value.algorithm}`);
  const raw = Buffer.from(value.ciphertext, "base64url");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = createDecipheriv(ALGORITHM, getMasterKey(), iv);
  if (aad) decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function moneyLast4(cents: number): string {
  return Math.abs(cents).toString().slice(-4).padStart(4, "0");
}
