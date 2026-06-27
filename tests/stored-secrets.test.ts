import { afterEach, describe, expect, it } from "vitest";
import {
  decryptStoredSecret,
  encryptStoredSecret,
} from "@/lib/crypto/keys";

const originalEncryptionKey = process.env.ENCRYPTION_KEY;

afterEach(() => {
  process.env.ENCRYPTION_KEY = originalEncryptionKey;
});

describe("stored secret encryption", () => {
  it("encrypts new secrets and reads legacy plaintext values", () => {
    process.env.ENCRYPTION_KEY = "a".repeat(64);
    const encrypted = encryptStoredSecret("top-secret");

    expect(encrypted).toMatch(/^enc:v1:/);
    expect(encrypted).not.toContain("top-secret");
    expect(decryptStoredSecret(encrypted)).toBe("top-secret");
    expect(decryptStoredSecret("legacy-plaintext")).toBe("legacy-plaintext");
  });

  it("rejects malformed encryption keys", () => {
    process.env.ENCRYPTION_KEY = "not-hex".padEnd(64, "z");
    expect(() => encryptStoredSecret("top-secret")).toThrow(
      "ENCRYPTION_KEY must be set"
    );
  });
});
