import { NextRequest, NextResponse } from "next/server";
import {
  getCheckoutSession,
  updateSessionStatus,
} from "@/lib/checkout/sessions";
import { SESSION_STATUS } from "@/lib/checkout/state-machine";

/**
 * POST /api/checkout/sessions/:id/recover
 *
 * Attempts to recover a stuck session where the customer approved
 * the payment but the ASE redirect never arrived.
 *
 * Checks the incoming payment status via the public Open Payments endpoint.
 * No authentication required — this is a customer-facing recovery flow.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;

  const session = await getCheckoutSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: { message: "Session not found" } },
      { status: 404 }
    );
  }
  if (!session) {
    return NextResponse.json(
      { error: { message: "Session not found" } },
      { status: 404 }
    );
  }

  // Only recoverable if still open with grant references
  if (session.status !== SESSION_STATUS.OPEN) {
    return NextResponse.json(
      { recovered: false, message: `Session is already ${session.status}` },
      { status: 200 }
    );
  }

  if (!session.continueAccessToken || !session.continueUri || !session.customerWallet) {
    return NextResponse.json(
      { recovered: false, message: "No pending grant to recover" },
      { status: 200 }
    );
  }

  try {
    // Check if the incoming payment has received funds
    if (session.incomingPaymentUrl) {
      const response = await fetch(session.incomingPaymentUrl, {
        headers: { Accept: "application/json" },
      });

      if (response.ok) {
        const incomingPayment = await response.json();

        // If funds were received, complete the flow
        if (
          incomingPayment.receivedAmount &&
          parseFloat(incomingPayment.receivedAmount.value) > 0
        ) {
          // We have an incoming payment — but without the interact_ref from the ASE
          // we can't continue the grant. The ASE callback is required for the interact_ref.
          //
          // Recovery path: mark the incoming payment as complete so the merchant
          // can reconcile manually. The funds are in the merchant's account.
          return NextResponse.json({
            recovered: true,
            action: "incoming_payment_received",
            message:
              "Payment received but grant continuation is pending. The funds are safe in your account.",
            incomingPayment,
          });
        }
      }
    }

    // Check if the grant has expired
    if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
      await updateSessionStatus(sessionId, SESSION_STATUS.EXPIRED);
      return NextResponse.json({
        recovered: true,
        action: "expired",
        message: "Session has expired.",
      });
    }

    return NextResponse.json({
      recovered: false,
      message: "Session is still pending. The customer may not have approved yet.",
    });
  } catch (err) {
    console.error("Recovery check failed:", err);
    return NextResponse.json(
      { error: { message: "Recovery check failed" } },
      { status: 500 }
    );
  }
}
