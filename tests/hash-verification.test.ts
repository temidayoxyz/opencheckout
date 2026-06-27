import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyInteractionHash } from "@/lib/open-payments/hash-verification";

describe("interaction hash verification", () => {
  const input = {
    clientNonce: "client-nonce",
    serverNonce: "server-nonce",
    interactRef: "interaction-reference",
    authServerUrl: "https://auth.example.com/account",
  };

  it("accepts padded and URL-safe valid hashes", () => {
    const hash = createHash("sha256")
      .update(Object.values(input).join("\n"))
      .digest("base64");
    const urlSafe = hash
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replace(/=+$/, "");

    expect(verifyInteractionHash({ ...input, receivedHash: hash })).toBe(true);
    expect(verifyInteractionHash({ ...input, receivedHash: urlSafe })).toBe(true);
  });

  it("rejects forged hashes", () => {
    expect(verifyInteractionHash({ ...input, receivedHash: "forged" })).toBe(
      false
    );
  });
});
