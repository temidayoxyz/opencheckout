import { describe, expect, it } from "vitest";
import { createSessionSchema } from "@/lib/checkout/validation";

const validInput = {
  mode: "payment" as const,
  line_items: [
    {
      price_data: {
        currency: "USD",
        product_data: { name: "Product" },
        unit_amount: 2000,
      },
      quantity: 1,
    },
  ],
  success_url: "https://store.example/success",
  cancel_url: "https://store.example/cancel",
};

describe("checkout request validation", () => {
  it("normalizes valid currency codes", () => {
    const result = createSessionSchema.parse(validInput);
    expect(result.line_items[0].price_data.currency).toBe("usd");
  });

  it("rejects invalid assets, mixed currencies, unsafe URLs, and huge totals", () => {
    expect(
      createSessionSchema.safeParse({
        ...validInput,
        line_items: [
          {
            ...validInput.line_items[0],
            price_data: {
              ...validInput.line_items[0].price_data,
              currency: "1$#",
            },
          },
        ],
      }).success
    ).toBe(false);
    expect(
      createSessionSchema.safeParse({
        ...validInput,
        success_url: "http://store.example/success",
      }).success
    ).toBe(false);
    expect(
      createSessionSchema.safeParse({
        ...validInput,
        line_items: [
          validInput.line_items[0],
          {
            ...validInput.line_items[0],
            price_data: {
              ...validInput.line_items[0].price_data,
              currency: "eur",
            },
          },
        ],
      }).success
    ).toBe(false);
    expect(
      createSessionSchema.safeParse({
        ...validInput,
        line_items: [
          {
            ...validInput.line_items[0],
            price_data: {
              ...validInput.line_items[0].price_data,
              unit_amount: 999_999_999_999,
            },
            quantity: 2,
          },
        ],
      }).success
    ).toBe(false);
  });
});
