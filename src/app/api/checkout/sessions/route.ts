import { NextRequest, NextResponse } from "next/server";
import { createSessionSchema } from "@/lib/checkout/validation";
import {
  createCheckoutSession,
  listCheckoutSessions,
  toPublicCheckoutSession,
} from "@/lib/checkout/sessions";
import { authenticateApiKey } from "@/lib/merchant/auth";
import {
  completeIdempotencyKey,
  hashRequestBody,
  reserveIdempotencyKey,
} from "@/lib/checkout/idempotency";
import { assertSafePublicUrl } from "@/lib/crypto/url-validation";
import { getAppBaseUrl } from "@/lib/http/base-url";

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

  try {
    await Promise.all([
      assertSafePublicUrl(parsed.data.success_url),
      assertSafePublicUrl(parsed.data.cancel_url),
    ]);
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          type: "invalid_request_error",
          message:
            error instanceof Error
              ? error.message
              : "Redirect URLs must be public HTTPS URLs",
        },
      },
      { status: 400 }
    );
  }

  // Idempotency reservation after validation gives us a stable body hash and
  // prevents concurrent duplicate requests from both doing checkout work.
  const idempotencyKey = request.headers.get("idempotency-key");
  const requestHash = hashRequestBody(body);
  if (idempotencyKey) {
    const lookup = await reserveIdempotencyKey(
      idempotencyKey,
      merchantId,
      requestHash
    );
    if (lookup.state === "cached") {
      return NextResponse.json(lookup.response, { status: lookup.statusCode });
    }
    if (lookup.state === "mismatch") {
      return NextResponse.json(
        {
          error: {
            type: "idempotency_error",
            message:
              "Idempotency-Key was already used with a different request body",
          },
        },
        { status: 409 }
      );
    }
    if (lookup.state === "in_progress") {
      return NextResponse.json(
        {
          error: {
            type: "idempotency_error",
            message:
              "An identical request with this Idempotency-Key is still processing",
          },
        },
        { status: 409 }
      );
    }
  }

  const baseUrl = getAppBaseUrl(request);

  try {
    const session = await createCheckoutSession(merchantId, parsed.data, baseUrl);
    const responseBody = toPublicCheckoutSession(session);
    const statusCode = 201;

    if (idempotencyKey) {
      await completeIdempotencyKey(
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

  const sessions = await listCheckoutSessions(merchantId, {
    limit: limit + 1,
    cursor,
  });
  const hasMore = sessions.length > limit;
  const page = hasMore ? sessions.slice(0, limit) : sessions;
  const nextCursor = hasMore ? page.at(-1)?.createdAt ?? null : null;

  return NextResponse.json({
    object: "list",
    data: page.map(toPublicCheckoutSession),
    has_more: hasMore,
    next_cursor: nextCursor,
    url: request.url,
  });
}
