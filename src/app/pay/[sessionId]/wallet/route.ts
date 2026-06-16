import { NextRequest, NextResponse } from "next/server";
import { walletSubmissionSchema } from "@/lib/checkout/validation";
import {
  getCheckoutSession,
  saveSessionOpReferences,
} from "@/lib/checkout/sessions";
import { SESSION_STATUS } from "@/lib/checkout/state-machine";
import { isValidWalletAddress } from "@/lib/open-payments/wallet-address";
import { createIncomingPayment } from "@/lib/open-payments/incoming-payment";
import { createQuote } from "@/lib/open-payments/quote";
import { requestOutgoingPaymentGrant } from "@/lib/open-payments/grant";
import { generateNonce } from "@/lib/crypto/ids";

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

  const session = await getCheckoutSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: { message: "Checkout session not found" } },
      { status: 404 }
    );
  }

  if (session.status !== SESSION_STATUS.OPEN) {
    return NextResponse.json(
      { error: { message: `Checkout session is ${session.status}` } },
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

  try {
    // Look up merchant's wallet address
    const { getMerchantPrivateKey } = await import("@/lib/merchant/onboarding");
    const keys = await getMerchantPrivateKey(session.merchantId);
    if (!keys) {
      return NextResponse.json(
        { error: { message: "Merchant configuration not found" } },
        { status: 500 }
      );
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
    const incomingPayment = await createIncomingPayment({
      merchantId: session.merchantId,
      walletAddress: keys.walletAddress,
      incomingAmount: session.amountTotal
        ? {
            value: session.amountTotal.toString(),
            assetCode: session.currency.toUpperCase(),
            assetScale: 2,
          }
        : undefined,
      expiresAt: session.expiresAt ?? new Date(Date.now() + 86400000).toISOString(),
      metadata,
    });

    // Step 2: Create a quote on the customer's ASE
    const quote = await createQuote({
      type: "incoming-amount",
      merchantId: session.merchantId,
      receiver: incomingPayment.id,
      walletAddress: customerWallet,
    });

    // Step 3: Request interactive outgoing payment grant
    const nonce = generateNonce();
    const baseUrl = process.env.BASE_URL ?? request.nextUrl.origin;
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
      customerWallet,
    });

    // Store hash verification data alongside existing session metadata
    const { getDb } = await import("@/lib/db");
    const { checkoutSessions } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const mergedMeta = {
      ...(session.metadata ?? {}),
      _oc_client_nonce: grantResult.clientNonce,
      _oc_server_nonce: grantResult.serverNonce ?? "",
      _oc_auth_server_url: grantResult.authServerUrl,
    };
    await getDb()
      .update(checkoutSessions)
      .set({ metadata: mergedMeta as Record<string, string> })
      .where(eq(checkoutSessions.id, sessionId));

    return NextResponse.json({
      interactUrl: pendingGrant.interact.redirect,
    });
  } catch (err) {
    console.error("Failed to prepare payment:", err);
    return NextResponse.json(
      { error: { message: "Failed to initiate payment. Please try again." } },
      { status: 500 }
    );
  }
}
