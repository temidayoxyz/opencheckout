import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { isTrustedDashboardMutation } from "@/lib/merchant/dashboard-auth";

function request(headers: Record<string, string>) {
  return new NextRequest("http://localhost:3005/api/dashboard/session", {
    headers,
  });
}

describe("dashboard same-origin protection", () => {
  it("accepts the browser origin represented by the Host header", () => {
    expect(
      isTrustedDashboardMutation(
        request({
          host: "127.0.0.1:3005",
          origin: "http://127.0.0.1:3005",
        })
      )
    ).toBe(true);
  });

  it("honors sanitized reverse-proxy host and protocol headers", () => {
    expect(
      isTrustedDashboardMutation(
        request({
          host: "internal:3000",
          origin: "https://checkout.example.com",
          "x-forwarded-host": "checkout.example.com",
          "x-forwarded-proto": "https",
        })
      )
    ).toBe(true);
  });

  it("rejects missing and cross-site origins", () => {
    expect(isTrustedDashboardMutation(request({ host: "localhost:3005" }))).toBe(
      false
    );
    expect(
      isTrustedDashboardMutation(
        request({
          host: "localhost:3005",
          origin: "https://attacker.example",
        })
      )
    ).toBe(false);
  });
});
