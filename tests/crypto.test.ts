import { describe, expect, it } from "vitest";
import { decryptField, encryptField } from "@/lib/security/crypto";

describe("field encryption", () => {
  it("round-trips values with authenticated additional data", () => {
    const encrypted = encryptField("9400000", "tenant:employee:BASE_SALARY");
    expect(encrypted.ciphertext).not.toContain("9400000");
    expect(decryptField(encrypted, "tenant:employee:BASE_SALARY")).toBe("9400000");
  });
});
