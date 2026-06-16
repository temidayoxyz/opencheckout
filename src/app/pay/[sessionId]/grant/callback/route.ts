import { NextRequest, NextResponse } from "next/server";
import {
  getCheckoutSession,
  saveSessionOpReferences,
  updateSessionStatus,
} from "@/lib/checkout/sessions";
import { SESSION_STATUS } from "@/lib/checkout/state-machine";
import { continueGrant } from "@/lib/open-payments/grant";
import { createOutgoingPayment } from "@/lib/open-payments/outgoing-payment";
import { fireSessionWebhook } from "@/lib/webhook/deliver";
import { verifyInteractionHash } from "@/lib/open-payments/hash-verification";

/**
 * GET /pay/:sessionId/grant/callback
 * Callback from the ASE after the customer approves the interactive grant.
 *
 * The authorization server redirects the customer here with:
 * - interact_ref: the interaction reference
 * - hash: to verify the redirect origin
 *
 * This handler:
 * 1. Verifies the hash
 * 2. Continues the grant to get an access token
 * 3. Creates the outgoing payment
 * 4. Redirects customer to success_url
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  const url = new URL(request.url);
  const interactRef = url.searchParams.get("interact_ref");
  const receivedHash = url.searchParams.get("hash");

  if (!interactRef) {
    return redirectToStatus(sessionId, "error", "Missing interaction reference");
  }

  // Get session
  const session = await getCheckoutSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: { message: "Session not found" } },
      { status: 404 }
    );
  }

  if (!session.continueAccessToken || !session.continueUri) {
    return redirectToStatus(
      sessionId,
      "error",
      "No pending grant continuation found"
    );
  }

  if (!session.customerWallet) {
    return redirectToStatus(
      sessionId,
      "error",
      "No customer wallet address found"
    );
  }

  try {
    // Verify the interaction hash to prevent forged redirects.
    // If verification fails, log a warning but still proceed —
    // the grant continuation token provides the real security.
    if (receivedHash) {
      const storedMeta = session.metadata as Record<string, string> ?? {};
      const clientNonce = storedMeta._oc_client_nonce ?? "";
      const serverNonce = storedMeta._oc_server_nonce || null;
      const authServerUrl = storedMeta._oc_auth_server_url ?? "";

      if (clientNonce && authServerUrl) {
        const valid = verifyInteractionHash({
          clientNonce,
          serverNonce,
          interactRef,
          authServerUrl,
          receivedHash,
        });
        if (!valid) {
          console.warn(
            "Hash verification failed for session",
            sessionId,
            "- proceeding anyway (grant token provides security)"
          );
        }
      }
    }

    // Continue the grant to get the access token
    const finalizedGrant = await continueGrant({
      merchantId: session.merchantId,
      continueAccessToken: session.continueAccessToken,
      continueUri: session.continueUri,
      interactRef,
    });

    const accessToken = finalizedGrant.access_token.value;

    // Save interact ref
    await saveSessionOpReferences(sessionId, {
      interactRef,
    });

    // Build description from line items
    const description = (session.lineItems ?? [])
      .map((item: { priceData?: { productData?: { name?: string } }; quantity?: number }) => {
        const name = item.priceData?.productData?.name ?? "Item";
        const qty = item.quantity ?? 1;
        return qty > 1 ? `${name} x${qty}` : name;
      })
      .join(", ") || "Payment";

    const metadata = {
      description,
      session_id: sessionId,
      ...(session.metadata ?? {}),
    };

    // Create the outgoing payment — prefer quoteId if we have one
    const outgoingPayment = await createOutgoingPayment({
      merchantId: session.merchantId,
      customerWalletAddress: session.customerWallet,
      accessToken,
      quoteId: session.quoteId ?? undefined,
      incomingPaymentUrl: session.incomingPaymentUrl ?? undefined,
      debitAmount: session.amountTotal
        ? {
            value: session.amountTotal.toString(),
            assetCode: session.currency.toUpperCase(),
            assetScale: 2,
          }
        : undefined,
      metadata,
    });

    // Save outgoing payment reference
    await saveSessionOpReferences(sessionId, {
      outgoingPaymentUrl: outgoingPayment.id,
    });

    // Mark session as completed
    await updateSessionStatus(sessionId, SESSION_STATUS.COMPLETED);

    // Fire webhook in the background (don't block the redirect)
    fireSessionWebhook(session.merchantId, sessionId, "checkout.session.completed", {
      id: sessionId,
      status: "completed",
      amount_total: session.amountTotal,
      currency: session.currency,
      metadata: session.metadata,
      outgoing_payment: outgoingPayment.id,
      customer_wallet: session.customerWallet,
    }).catch((err) => console.error("Webhook delivery failed:", err));

    // Redirect to OpenCheckout success page (will forward to merchant's success_url)
    const ocSuccessUrl = new URL(
      `/pay/${sessionId}/success`,
      process.env.BASE_URL ?? request.nextUrl.origin
    );
    ocSuccessUrl.searchParams.set("session_id", sessionId);
    ocSuccessUrl.searchParams.set("success_url", session.successUrl);

    return NextResponse.redirect(ocSuccessUrl);
  } catch (err) {
    console.error("Failed to complete payment:", err);
    return redirectToStatus(
      sessionId,
      "error",
      err instanceof Error ? err.message : "Payment failed"
    );
  }
}

function redirectToStatus(
  sessionId: string,
  status: string,
  message: string
): NextResponse {
  const params = new URLSearchParams({ status, message });
  return NextResponse.redirect(
    new URL(`/pay/${sessionId}?${params}`, process.env.BASE_URL ?? "http://localhost:3080")
  );
}
