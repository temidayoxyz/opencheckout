import { NextRequest, NextResponse } from "next/server";
import {
  getCheckoutSession,
  toPublicCheckoutSession,
  updateSessionStatus,
} from "@/lib/checkout/sessions";
import { SESSION_STATUS } from "@/lib/checkout/state-machine";
import { authenticateApiKey } from "@/lib/merchant/auth";

/** POST /api/checkout/sessions/:id/cancel */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const merchant = await authenticateApiKey(
    request.headers.get("authorization")
  );
  if (!merchant) {
    return NextResponse.json(
      { error: { type: "authentication_error", message: "Invalid API key" } },
      { status: 401 }
    );
  }

  const { id } = await params;
  const session = await getCheckoutSession(id);
  if (!session || session.merchantId !== merchant.id) {
    return NextResponse.json(
      {
        error: {
          type: "not_found",
          message: `No checkout session found with id: ${id}`,
        },
      },
      { status: 404 }
    );
  }

  if (
    session.status !== SESSION_STATUS.OPEN &&
    session.status !== SESSION_STATUS.AWAITING_APPROVAL
  ) {
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

  const updated = await updateSessionStatus(id, SESSION_STATUS.CANCELED);
  return NextResponse.json(
    updated ? toPublicCheckoutSession(updated) : null
  );
}
