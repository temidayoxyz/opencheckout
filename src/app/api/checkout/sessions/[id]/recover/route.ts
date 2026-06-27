import { NextRequest, NextResponse } from "next/server";
import {
  getCheckoutSession,
  saveSessionOpReferences,
  updateSessionStatus,
} from "@/lib/checkout/sessions";
import { SESSION_STATUS } from "@/lib/checkout/state-machine";
import { assertSafePublicUrl } from "@/lib/crypto/url-validation";
import { fireSessionWebhook } from "@/lib/webhook/deliver";
import { checkRateLimit, getRequestClientKey } from "@/lib/http/rate-limit";

/**
 * POST /api/checkout/sessions/:id/recover
 *
 * Resumes approval when possible and reconciles a payment whose provider
 * completed successfully after the browser callback was interrupted.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;
  const rateLimit = checkRateLimit(
    `recover:${sessionId}:${getRequestClientKey(request)}`,
    { limit: 20, windowMs: 10 * 60 * 1000 }
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: { message: "Too many status checks. Try again later." } },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      }
    );
  }
  const session = await getCheckoutSession(sessionId);

  if (!session) {
    return NextResponse.json(
      { error: { message: "Session not found" } },
      { status: 404 }
    );
  }

  if (
    session.status === SESSION_STATUS.COMPLETED ||
    session.status === SESSION_STATUS.EXPIRED ||
    session.status === SESSION_STATUS.CANCELED
  ) {
    return NextResponse.json({
      recovered: false,
      message: `Session is already ${session.status}`,
    });
  }

  if (session.status === SESSION_STATUS.PREPARING) {
    return NextResponse.json({
      recovered: false,
      message: "Payment preparation is still in progress. Please wait a moment.",
    });
  }

  if (
    session.status === SESSION_STATUS.AWAITING_APPROVAL &&
    session.grantInteractUrl
  ) {
    return NextResponse.json({
      recovered: true,
      action: "resume_approval",
      message: "Your payment is ready for approval.",
      interact_url: session.grantInteractUrl,
    });
  }

  if (session.status === SESSION_STATUS.PROCESSING) {
    return reconcileProcessingSession(session);
  }

  return NextResponse.json({
    recovered: false,
    message: "No pending payment approval was found. You can try again.",
  });
}

async function reconcileProcessingSession(
  session: NonNullable<Awaited<ReturnType<typeof getCheckoutSession>>>
) {
  if (!session.incomingPaymentUrl || session.amountTotal === null) {
    return NextResponse.json({
      recovered: false,
      message:
        "Payment completion is still being reconciled. Do not submit another payment.",
    });
  }

  try {
    await assertSafePublicUrl(session.incomingPaymentUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const response = await fetch(session.incomingPaymentUrl, {
      redirect: "manual",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return NextResponse.json({
        recovered: false,
        message: "The payment provider has not confirmed completion yet.",
      });
    }

    const incomingPayment = (await response.json()) as {
      receivedAmount?: { value?: string };
    };
    const receivedValue = incomingPayment.receivedAmount?.value;
    if (!receivedValue || BigInt(receivedValue) < BigInt(session.amountTotal)) {
      return NextResponse.json({
        recovered: false,
        message: "The payment provider has not confirmed the full amount yet.",
      });
    }

    await saveSessionOpReferences(session.id, {
      continueAccessToken: null,
      continueUri: null,
      grantInteractUrl: null,
    });
    await updateSessionStatus(session.id, SESSION_STATUS.COMPLETED);
    await fireSessionWebhook(
      session.merchantId,
      session.id,
      "checkout.session.completed",
      {
        id: session.id,
        status: "completed",
        amount_total: session.amountTotal,
        currency: session.currency,
        metadata: session.metadata,
        outgoing_payment: session.outgoingPaymentUrl,
        customer_wallet: session.customerWallet,
        reconciled: true,
      }
    );

    return NextResponse.json({
      recovered: true,
      action: "completed",
      message: "Payment was received and the checkout has been reconciled.",
    });
  } catch (error) {
    console.error("Recovery check failed:", error);
    return NextResponse.json(
      { error: { message: "Recovery check failed" } },
      { status: 500 }
    );
  }
}
