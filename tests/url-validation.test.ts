import { describe, expect, it } from "vitest";
import {
  isPrivateAddress,
  isSafePublicUrl,
} from "@/lib/crypto/url-validation";

describe("public URL validation", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "172.16.0.1",
    "192.168.1.1",
    "::1",
    "fc00::1",
    "::ffff:127.0.0.1",
    "::ffff:192.168.1.1",
  ])("blocks private address %s", (address) => {
    expect(isPrivateAddress(address)).toBe(true);
  });

  it("allows public HTTPS URLs and rejects unsafe schemes and hosts", () => {
    expect(isSafePublicUrl("https://wallet.example.com/alice")).toBe(true);
    expect(isSafePublicUrl("http://wallet.example.com/alice")).toBe(false);
    expect(isSafePublicUrl("https://localhost/alice")).toBe(false);
    expect(isSafePublicUrl("file:///etc/passwd")).toBe(false);
    expect(isSafePublicUrl("https://user:pass@wallet.example.com")).toBe(false);
  });
});
