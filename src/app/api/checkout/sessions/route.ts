import { NextRequest, NextResponse } from "next/server";
import { createSessionSchema } from "@/lib/checkout/validation";
import { createCheckoutSession, listCheckoutSessions } from "@/lib/checkout/sessions";
import { authenticateApiKey } from "@/lib/merchant/auth";
import { checkIdempotencyKey, saveIdempotencyKey } from "@/lib/checkout/idempotency";

async function getMerchantId(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  const merchant = await authenticateApiKey(authHeader);
  return merchant?.id ?? null;
}

/**
 * POST /api/checkout/sessions
 * Create a new checkout session.
 */
export async function POST(request: NextRequest) {
  const merchantId = await getMerchantId(request);
  if (!merchantId) {
    return NextResponse.json(
      { error: { type: "authentication_error", message: "Invalid API key" } },
      { status: 401 }
    );
  }

  // Idempotency check
  const idempotencyKey = request.headers.get("idempotency-key");
  if (idempotencyKey) {
    const existing = await checkIdempotencyKey(idempotencyKey, merchantId);
    if (existing) {
      return NextResponse.json(existing.response, {
        status: existing.statusCode,
      });
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { type: "invalid_request_error", message: "Invalid JSON body" } },
      { status: 400 }
    );
  }

  const parsed = createSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          type: "invalid_request_error",
          message: parsed.error.issues[0]?.message ?? "Invalid request body",
        },
      },
      { status: 400 }
    );
  }

  const baseUrl = process.env.BASE_URL ?? request.nextUrl.origin;

  try {
    const session = await createCheckoutSession(merchantId, parsed.data, baseUrl);
    const responseBody = { ...session };
    const statusCode = 201;

    // Save idempotency key for future duplicate requests
    if (idempotencyKey) {
      await saveIdempotencyKey(
        idempotencyKey,
        merchantId,
        session.id,
        responseBody,
        statusCode
      );
    }

    return NextResponse.json(responseBody, { status: statusCode });
  } catch (err) {
    console.error("Failed to create checkout session:", err);
    return NextResponse.json(
      { error: { type: "api_error", message: "Failed to create checkout session" } },
      { status: 500 }
    );
  }
}

/**
 * GET /api/checkout/sessions
 * List checkout sessions for the authenticated merchant.
 */
export async function GET(request: NextRequest) {
  const merchantId = await getMerchantId(request);
  if (!merchantId) {
    return NextResponse.json(
      { error: { type: "authentication_error", message: "Invalid API key" } },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "10", 10) || 10, 100);
  const cursor = searchParams.get("cursor") ?? undefined;

  const sessions = await listCheckoutSessions(merchantId, { limit, cursor });

  return NextResponse.json({
    object: "list",
    data: sessions,
    has_more: sessions.length === limit,
    url: request.url,
  });
}
