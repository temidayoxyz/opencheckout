import { NextRequest, NextResponse } from "next/server";
import {
  getCheckoutSession,
  toPublicCheckoutSession,
} from "@/lib/checkout/sessions";
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

  return NextResponse.json(toPublicCheckoutSession(session));
}
