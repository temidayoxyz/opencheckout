import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { beforeAll, describe, expect, it, vi } from "vitest";

const databasePath = join(tmpdir(), `opencheckout-${randomUUID()}.db`);
const merchantId = "mer_integration";
const apiKey = "sk_integration_test_key";

beforeAll(async () => {
  process.env.DATABASE_URL = databasePath;
  process.env.ENCRYPTION_KEY = "b".repeat(64);
  vi.resetModules();

  const { ensureSchema } = await import("../scripts/ensure-schema.mjs");
  ensureSchema(databasePath);

  const [{ getDb, schema }, { hashApiKey }] = await Promise.all([
    import("@/lib/db"),
    import("@/lib/merchant/auth"),
  ]);
  await getDb().insert(schema.merchants).values({
    id: merchantId,
    name: "Integration Store",
    walletAddress: "https://wallet.example/store",
    privateKey: "encrypted-private-key",
    keyId: "key-id",
  });
  await getDb().insert(schema.apiKeys).values({
    id: "ak_integration",
    merchantId,
    keyHash: hashApiKey(apiKey),
    name: "Integration",
  });
});

describe("runtime integration", () => {
  it("creates an HttpOnly dashboard session without exposing the key", async () => {
    const [{ NextRequest }, route] = await Promise.all([
      import("next/server"),
      import("@/app/api/dashboard/session/route"),
    ]);
    const response = await route.POST(
      new NextRequest("http://localhost/api/dashboard/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost",
        },
        body: JSON.stringify({ api_key: apiKey }),
      })
    );

    expect(response.status).toBe(200);
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("oc_dashboard_session=");
    expect(cookie).not.toContain(apiKey);
    expect(cookie.toLowerCase()).toContain("httponly");
    expect(cookie.toLowerCase()).toContain("samesite=strict");
    expect(await response.json()).not.toHaveProperty("api_key");
  });

  it("atomically allows only one payment preparation claim", async () => {
    const [{ getDb, schema }, sessions] = await Promise.all([
      import("@/lib/db"),
      import("@/lib/checkout/sessions"),
    ]);
    const id = "cs_concurrency_test";
    await getDb().insert(schema.checkoutSessions).values({
      id,
      merchantId,
      mode: "payment",
      status: "open",
      amountTotal: 2000,
      currency: "usd",
      lineItems: [],
      successUrl: "https://store.example/success",
      cancelUrl: "https://store.example/cancel",
      url: `http://localhost/pay/${id}`,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    const claims = await Promise.all([
      sessions.claimSessionForPreparation(id),
      sessions.claimSessionForPreparation(id),
    ]);
    expect(claims.filter(Boolean)).toHaveLength(1);

    await sessions.releaseSessionPreparation(id);
    expect((await sessions.getCheckoutSession(id))?.status).toBe("open");
  });
});
