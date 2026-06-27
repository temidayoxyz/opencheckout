import { describe, expect, it } from "vitest";
import { toPublicCheckoutSession } from "@/lib/checkout/sessions";

describe("public checkout session contract", () => {
  it("returns snake_case fields without internal grant secrets", () => {
    const result = toPublicCheckoutSession({
      id: "cs_test",
      merchantId: "mer_private",
      mode: "payment",
      status: "open",
      amountTotal: 2000,
      currency: "usd",
      lineItems: [
        {
          priceData: {
            currency: "usd",
            productData: { name: "T-shirt" },
            unitAmount: 2000,
          },
          quantity: 1,
        },
      ],
      metadata: { order_id: "123" },
      successUrl: "https://store.example/success",
      cancelUrl: "https://store.example/cancel",
      url: "https://checkout.example/pay/cs_test",
      customerWallet: null,
      incomingPaymentUrl: null,
      outgoingPaymentUrl: null,
      continueAccessToken: "never-public",
      continueUri: "https://auth.example/continue",
      createdAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2026-01-02T00:00:00.000Z",
      completedAt: null,
    });

    expect(result).toMatchObject({
      id: "cs_test",
      object: "checkout.session",
      amount_total: 2000,
      success_url: "https://store.example/success",
      customer_wallet: null,
    });
    expect(result.line_items[0].price_data.unit_amount).toBe(2000);
    expect(result).not.toHaveProperty("merchantId");
    expect(result).not.toHaveProperty("continueAccessToken");
    expect(result).not.toHaveProperty("continueUri");
  });
});
