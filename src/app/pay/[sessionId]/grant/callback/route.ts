import { NextRequest, NextResponse } from "next/server";
import {
  claimSessionForPayment,
  getCheckoutSession,
  saveSessionOpReferences,
  updateSessionStatus,
} from "@/lib/checkout/sessions";
import { SESSION_STATUS } from "@/lib/checkout/state-machine";
import { continueGrant } from "@/lib/open-payments/grant";
import { createOutgoingPayment } from "@/lib/open-payments/outgoing-payment";
import { fireSessionWebhook } from "@/lib/webhook/deliver";
import { verifyInteractionHash } from "@/lib/open-payments/hash-verification";
import { toOpenPaymentsAmount } from "@/lib/checkout/currency";
import { getAppBaseUrl } from "@/lib/http/base-url";

/**
 * GET /pay/:sessionId/grant/callback
 * Callback from the ASE after the customer approves the interactive grant.
 *
 * This handler fails closed on hash verification and atomically claims the
 * session before creating an outgoing payment, preventing duplicate callbacks
 * from issuing duplicate payment instructions.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  const url = new URL(request.url);
  const baseUrl = getAppBaseUrl(request);
  const interactRef = url.searchParams.get("interact_ref");
  const receivedHash = url.searchParams.get("hash");

  if (!interactRef || !receivedHash) {
    return redirectToStatus(
      baseUrl,
      sessionId,
      "error",
      "Missing interaction reference or hash"
    );
  }

  const existingSession = await getCheckoutSession(sessionId);
  if (!existingSession) {
    return NextResponse.json(
      { error: { message: "Session not found" } },
      { status: 404 }
    );
  }

  if (existingSession.status === SESSION_STATUS.COMPLETED) {
    return redirectToSuccess(sessionId, baseUrl);
  }

  if (!existingSession.grantClientNonce || !existingSession.grantAuthServerUrl) {
    return redirectToStatus(
      baseUrl,
      sessionId,
      "error",
      "Missing grant verification state"
    );
  }

  const validHash = verifyInteractionHash({
    clientNonce: existingSession.grantClientNonce,
    serverNonce: existingSession.grantServerNonce || null,
    interactRef,
    authServerUrl: existingSession.grantAuthServerUrl,
    receivedHash,
  });

  if (!validHash) {
    return redirectToStatus(
      baseUrl,
      sessionId,
      "error",
      "Invalid interaction hash"
    );
  }

  if (!existingSession.continueAccessToken || !existingSession.continueUri) {
    return redirectToStatus(
      baseUrl,
      sessionId,
      "error",
      "No pending grant continuation found"
    );
  }

  if (!existingSession.customerWallet) {
    return redirectToStatus(
      baseUrl,
      sessionId,
      "error",
      "No customer wallet address found"
    );
  }

  const continueAccessToken = existingSession.continueAccessToken;
  const continueUri = existingSession.continueUri;
  const customerWallet = existingSession.customerWallet;

  const session = await claimSessionForPayment(sessionId);
  if (!session) {
    return redirectToStatus(
      baseUrl,
      sessionId,
      "error",
      `Checkout session is ${existingSession.status}`
    );
  }

  try {
    const finalizedGrant = await continueGrant({
      merchantId: session.merchantId,
      continueAccessToken,
      continueUri,
      interactRef,
    });

    const accessToken = finalizedGrant.access_token.value;

    await saveSessionOpReferences(sessionId, { interactRef });

    const description =
      (session.lineItems ?? [])
        .map(
          (item: {
            priceData?: { productData?: { name?: string } };
            quantity?: number;
          }) => {
            const name = item.priceData?.productData?.name ?? "Item";
            const qty = item.quantity ?? 1;
            return qty > 1 ? `${name} x${qty}` : name;
          }
        )
        .join(", ") || "Payment";

    const metadata = {
      description,
      session_id: sessionId,
      ...(session.metadata ?? {}),
    };

    const outgoingPayment = await createOutgoingPayment({
      merchantId: session.merchantId,
      customerWalletAddress: customerWallet,
      accessToken,
      quoteId: session.quoteId ?? undefined,
      incomingPaymentUrl: session.incomingPaymentUrl ?? undefined,
      debitAmount: session.amountTotal
        ? toOpenPaymentsAmount(session.amountTotal, session.currency)
        : undefined,
      metadata,
    });

    await saveSessionOpReferences(sessionId, {
      outgoingPaymentUrl: outgoingPayment.id,
      continueAccessToken: null,
      continueUri: null,
      grantInteractUrl: null,
    });

    await updateSessionStatus(sessionId, SESSION_STATUS.COMPLETED);

    fireSessionWebhook(
      session.merchantId,
      sessionId,
      "checkout.session.completed",
      {
        id: sessionId,
        status: "completed",
        amount_total: session.amountTotal,
        currency: session.currency,
        metadata: session.metadata,
        outgoing_payment: outgoingPayment.id,
        customer_wallet: customerWallet,
      }
    ).catch((err) => console.error("Webhook delivery failed:", err));

    return redirectToSuccess(sessionId, baseUrl);
  } catch (err) {
    console.error("Failed to complete payment:", err);
    return redirectToStatus(
      baseUrl,
      sessionId,
      "error",
      "Payment could not be completed. Please check its status before retrying."
    );
  }
}

function redirectToSuccess(sessionId: string, origin: string): NextResponse {
  return NextResponse.redirect(new URL(`/pay/${sessionId}/success`, origin));
}

function redirectToStatus(
  origin: string,
  sessionId: string,
  status: string,
  message: string
): NextResponse {
  const params = new URLSearchParams({ status, message });
  return NextResponse.redirect(
    new URL(`/pay/${sessionId}?${params}`, origin)
  );
}
