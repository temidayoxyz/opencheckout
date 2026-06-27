import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { getAppBaseUrl } from "@/lib/http/base-url";

const originalBaseUrl = process.env.BASE_URL;

afterEach(() => {
  if (originalBaseUrl === undefined) delete process.env.BASE_URL;
  else process.env.BASE_URL = originalBaseUrl;
});

describe("application base URL", () => {
  it("treats BASE_URL as the canonical callback origin", () => {
    process.env.BASE_URL = "http://127.0.0.1:3005";
    const request = new NextRequest("http://localhost:3005/api/checkout/sessions", {
      headers: { host: "localhost:3005" },
    });

    expect(getAppBaseUrl(request)).toBe("http://127.0.0.1:3005");
  });

  it("falls back to the real forwarded request origin", () => {
    delete process.env.BASE_URL;
    const request = new NextRequest("http://localhost:3005/api/checkout/sessions", {
      headers: {
        host: "internal:3000",
        "x-forwarded-host": "checkout.example.com",
        "x-forwarded-proto": "https",
      },
    });

    expect(getAppBaseUrl(request)).toBe("https://checkout.example.com");
  });
});
