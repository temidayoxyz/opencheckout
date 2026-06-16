import { NextRequest, NextResponse } from "next/server";
import { getCheckoutSession, updateSessionStatus } from "@/lib/checkout/sessions";
import { SESSION_STATUS } from "@/lib/checkout/state-machine";
import { authenticateApiKey } from "@/lib/merchant/auth";

async function getMerchantId(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  const merchant = await authenticateApiKey(authHeader);
  return merchant?.id ?? null;
}

/**
 * GET /api/checkout/sessions/:id
 * Retrieve a checkout session by ID.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const merchantId = await getMerchantId(request);
  if (!merchantId) {
    return NextResponse.json(
      { error: { type: "authentication_error", message: "Invalid API key" } },
      { status: 401 }
    );
  }

  const { id } = await params;
  const session = await getCheckoutSession(id);

  if (!session) {
    return NextResponse.json(
      { error: { type: "not_found", message: `No checkout session found with id: ${id}` } },
      { status: 404 }
    );
  }

  if (session.merchantId !== merchantId) {
    return NextResponse.json(
      { error: { type: "not_found", message: `No checkout session found with id: ${id}` } },
      { status: 404 }
    );
  }

  return NextResponse.json(session);
}

/**
 * POST /api/checkout/sessions/:id/expire
 * Expire a checkout session.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const merchantId = await getMerchantId(request);
  if (!merchantId) {
    return NextResponse.json(
      { error: { type: "authentication_error", message: "Invalid API key" } },
      { status: 401 }
    );
  }

  const { id } = await params;
  const session = await getCheckoutSession(id);

  if (!session || session.merchantId !== merchantId) {
    return NextResponse.json(
      { error: { type: "not_found", message: `No checkout session found with id: ${id}` } },
      { status: 404 }
    );
  }

  if (session.status !== SESSION_STATUS.OPEN) {
    return NextResponse.json(
      {
        error: {
          type: "invalid_request_error",
          message: `Session is already ${session.status}`,
        },
      },
      { status: 400 }
    );
  }

  const updated = await updateSessionStatus(id, SESSION_STATUS.EXPIRED);
  return NextResponse.json(updated);
}
