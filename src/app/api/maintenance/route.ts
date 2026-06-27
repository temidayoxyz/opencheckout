import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { cleanExpiredIdempotencyKeys } from "@/lib/checkout/idempotency";
import { expireStaleSessions } from "@/lib/checkout/sessions";
import { retryPendingWebhooks } from "@/lib/webhook/deliver";

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.MAINTENANCE_SECRET;
  if (!expectedSecret) {
    return NextResponse.json(
      { error: { message: "Maintenance endpoint is disabled" } },
      { status: 503 }
    );
  }

  const authorization = request.headers.get("authorization") ?? "";
  const providedSecret = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";
  if (!safeEqual(providedSecret, expectedSecret)) {
    return NextResponse.json(
      { error: { message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const [expiredSessions, cleanedIdempotencyKeys, webhooks] =
    await Promise.all([
      expireStaleSessions(),
      cleanExpiredIdempotencyKeys(),
      retryPendingWebhooks(),
    ]);

  return NextResponse.json({
    success: true,
    expired_sessions: expiredSessions.length,
    cleaned_idempotency_keys: cleanedIdempotencyKeys,
    webhooks,
  });
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}
