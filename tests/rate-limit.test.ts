import { describe, expect, it } from "vitest";
import { checkRateLimit } from "@/lib/http/rate-limit";

describe("rate limiter", () => {
  it("allows requests up to the limit and returns retry guidance", () => {
    const key = `test-${crypto.randomUUID()}`;
    expect(checkRateLimit(key, { limit: 2, windowMs: 60_000 }).allowed).toBe(
      true
    );
    expect(checkRateLimit(key, { limit: 2, windowMs: 60_000 }).allowed).toBe(
      true
    );
    const blocked = checkRateLimit(key, { limit: 2, windowMs: 60_000 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });
});
