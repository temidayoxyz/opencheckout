import { describe, expect, it } from "vitest";
import {
  getCurrencyScale,
  toOpenPaymentsAmount,
} from "@/lib/checkout/currency";

describe("currency conversion", () => {
  it.each([
    ["USD", 2],
    ["jpy", 0],
    ["KWD", 3],
  ])("uses the correct scale for %s", (currency, scale) => {
    expect(getCurrencyScale(currency)).toBe(scale);
  });

  it("maps integer API amounts to Open Payments amounts", () => {
    expect(toOpenPaymentsAmount(20000, "usd")).toEqual({
      value: "20000",
      assetCode: "USD",
      assetScale: 2,
    });
  });
});
