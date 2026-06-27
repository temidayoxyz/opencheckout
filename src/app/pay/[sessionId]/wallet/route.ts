import { NextRequest, NextResponse } from "next/server";
import { walletSubmissionSchema } from "@/lib/checkout/validation";
import {
  claimSessionForPreparation,
  getCheckoutSession,
  releaseSessionPreparation,
  saveSessionOpReferences,
  updateSessionStatus,
} from "@/lib/checkout/sessions";
import { SESSION_STATUS } from "@/lib/checkout/state-machine";
import { isValidWalletAddress } from "@/lib/open-payments/wallet-address";
import { createIncomingPayment } from "@/lib/open-payments/incoming-payment";
import { createQuote } from "@/lib/open-payments/quote";
import { requestOutgoingPaymentGrant } from "@/lib/open-payments/grant";
import { generateNonce } from "@/lib/crypto/ids";
import { toOpenPaymentsAmount } from "@/lib/checkout/currency";
import { getAppBaseUrl } from "@/lib/http/base-url";
import { checkRateLimit, getRequestClientKey } from "@/lib/http/rate-limit";

/**
 * POST /pay/:sessionId/wallet
 *
 * Accepts the customer's wallet address and prepares the full payment:
 * 1. Creates an incoming payment on the merchant's wallet
 * 2. Creates a quote on the customer's ASE
 * 3. Initiates the interactive outgoing payment grant
 *
 * Returns the interact redirect URL for the customer to approve payment.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  const rateLimit = checkRateLimit(
    `wallet:${sessionId}:${getRequestClientKey(request)}`,
    { limit: 10, windowMs: 10 * 60 * 1000 }
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: { message: "Too many payment attempts. Try again later." } },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { message: "Invalid JSON body" } },
      { status: 400 }
    );
  }

  const parsed = walletSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          message: parsed.error.issues[0]?.message ?? "Invalid wallet address",
        },
      },
      { status: 400 }
    );
  }

  const customerWallet = parsed.data.wallet_address;

  const existingSession = await getCheckoutSession(sessionId);
  if (!existingSession) {
    return NextResponse.json(
      { error: { message: "Checkout session not found" } },
      { status: 404 }
    );
  }

  if (existingSession.status !== SESSION_STATUS.OPEN) {
    return NextResponse.json(
      { error: { message: `Checkout session is ${existingSession.status}` } },
      { status: 400 }
    );
  }

  // Validate the customer's wallet address
  const customerWalletInfo = await isValidWalletAddress(customerWallet);
  if (!customerWalletInfo) {
    return NextResponse.json(
      { error: { message: "Invalid wallet address. Could not resolve it." } },
      { status: 400 }
    );
  }

  const session = await claimSessionForPreparation(sessionId);
  if (!session) {
    return NextResponse.json(
      {
        error: {
          message: "This checkout is already being prepared. Refresh to continue.",
        },
      },
      { status: 409 }
    );
  }

  try {
    // Look up merchant's wallet address
    const { getMerchantPrivateKey } = await import("@/lib/merchant/onboarding");
    const keys = await getMerchantPrivateKey(session.merchantId);
    if (!keys) {
      throw new Error("Merchant configuration not found");
    }

    // Build a description from line items
    const description = (session.lineItems ?? [])
      .map((item) => {
        const name = item.priceData?.productData?.name ?? "Item";
        const qty = item.quantity ?? 1;
        return qty > 1 ? `${name} x${qty}` : name;
      })
      .join(", ") || "Checkout payment";

    // Step 1: Create an incoming payment on the merchant's wallet
    const metadata = {
      description,
      session_id: sessionId,
      ...(session.metadata ?? {}),
    };
    const incomingPayment = session.incomingPaymentUrl
      ? { id: session.incomingPaymentUrl }
      : await createIncomingPayment({
          merchantId: session.merchantId,
          walletAddress: keys.walletAddress,
          incomingAmount: session.amountTotal
            ? toOpenPaymentsAmount(session.amountTotal, session.currency)
            : undefined,
          expiresAt:
            session.expiresAt ?? new Date(Date.now() + 86400000).toISOString(),
          metadata,
        });

    if (!session.incomingPaymentUrl) {
      await saveSessionOpReferences(sessionId, {
        incomingPaymentUrl: incomingPayment.id,
        incomingPaymentId: incomingPayment.id,
      });
    }

    // Step 2: Create a quote on the customer's ASE
    const quote = await createQuote({
      type: "incoming-amount",
      merchantId: session.merchantId,
      receiver: incomingPayment.id,
      walletAddress: customerWallet,
    });

    await saveSessionOpReferences(sessionId, {
      quoteId: quote.id,
      quoteUrl: quote.id,
    });

    // Step 3: Request interactive outgoing payment grant
    const nonce = generateNonce();
    const baseUrl = getAppBaseUrl(request);
    const finishRedirectUri = `${baseUrl}/pay/${sessionId}/grant/callback`;

    const grantResult = await requestOutgoingPaymentGrant({
      merchantId: session.merchantId,
      customerWalletAddress: customerWallet,
      debitAmount: quote.debitAmount
        ? {
            value: quote.debitAmount.value,
            assetCode: quote.debitAmount.assetCode,
            assetScale: quote.debitAmount.assetScale,
          }
        : undefined,
      finishRedirectUri,
      nonce,
    });

    const { pendingGrant } = grantResult;

    // Save all Open Payments references to the session
    await saveSessionOpReferences(sessionId, {
      incomingPaymentUrl: incomingPayment.id,
      quoteId: quote.id,
      quoteUrl: quote.id,
      continueAccessToken: pendingGrant.continue.access_token.value,
      continueUri: pendingGrant.continue.uri,
      grantClientNonce: grantResult.clientNonce,
      grantServerNonce: grantResult.serverNonce ?? "",
      grantAuthServerUrl: grantResult.authServerUrl,
      grantInteractUrl: pendingGrant.interact.redirect,
      customerWallet,
    });

    await updateSessionStatus(sessionId, SESSION_STATUS.AWAITING_APPROVAL);

    return NextResponse.json({
      interactUrl: pendingGrant.interact.redirect,
    });
  } catch (err) {
    console.error("Failed to prepare payment:", err);
    await releaseSessionPreparation(sessionId).catch((releaseError) =>
      console.error("Failed to release payment preparation:", releaseError)
    );
    return NextResponse.json(
      { error: { message: "Failed to initiate payment. Please try again." } },
      { status: 500 }
    );
  }
}
