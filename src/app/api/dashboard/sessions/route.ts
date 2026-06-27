import { NextRequest, NextResponse } from "next/server";
import {
  listCheckoutSessions,
  toPublicCheckoutSession,
} from "@/lib/checkout/sessions";
import { authenticateDashboardRequest } from "@/lib/merchant/dashboard-auth";

export async function GET(request: NextRequest) {
  const merchant = await authenticateDashboardRequest(request);
  if (!merchant) {
    return NextResponse.json(
      { error: { message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const requestedLimit = Number.parseInt(
    request.nextUrl.searchParams.get("limit") ?? "50",
    10
  );
  const limit = Math.min(Math.max(requestedLimit || 50, 1), 100);
  const sessions = await listCheckoutSessions(merchant.id, { limit });
  const response = NextResponse.json({
    data: sessions.map(toPublicCheckoutSession),
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
