import type {
  IncomingPayment,
  IncomingPaymentWithPaymentMethods,
} from "@interledger/open-payments";
import { getMerchantClient } from "./client";
import { getMerchantPrivateKey } from "@/lib/merchant/onboarding";
import { resolveWalletAddress } from "./wallet-address";

interface CreateIncomingPaymentParams {
  merchantId: string;
  walletAddress: string;
  incomingAmount?: {
    value: string;
    assetCode: string;
    assetScale: number;
  };
  expiresAt: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create an incoming payment on the merchant's wallet.
 * This is called when a checkout session is created.
 *
 * If incomingAmount is provided, it sets the maximum amount the
 * recipient expects to receive.
 * If omitted by a future flow, the incoming payment is open-ended.
 */
export async function createIncomingPayment(
  params: CreateIncomingPaymentParams
): Promise<IncomingPaymentWithPaymentMethods> {
  const keys = await getMerchantPrivateKey(params.merchantId);
  if (!keys) throw new Error("Merchant not found");

  const client = await getMerchantClient(keys);

  // First, resolve the wallet address to find the auth server
  const resolvedWallet = await resolveWalletAddress(keys.walletAddress);

  // Request an incoming payment grant
  const grant = await client.grant.request(
    { url: resolvedWallet.authServer },
    {
      access_token: {
        access: [
          {
            type: "incoming-payment",
            actions: ["create", "read", "read-all", "list", "complete"],
          },
        ],
      },
    }
  );

  const { isFinalizedGrantWithAccessToken } = await import(
    "@interledger/open-payments"
  );
  if (!isFinalizedGrantWithAccessToken(grant)) {
    throw new Error("Expected finalized grant with access token");
  }

  const accessToken = grant.access_token.value;

  // Get the wallet address to find the resource server
  const walletAddressInfo = await resolveWalletAddress(params.walletAddress);

  const body: {
    walletAddress: string;
    expiresAt: string;
    incomingAmount?: { value: string; assetCode: string; assetScale: number };
    metadata?: Record<string, unknown>;
  } = {
    walletAddress: params.walletAddress,
    expiresAt: params.expiresAt,
  };

  if (params.incomingAmount) {
    body.incomingAmount = params.incomingAmount;
  }

  if (params.metadata) {
    body.metadata = params.metadata;
  }

  const incomingPayment = (await client.incomingPayment.create(
    {
      url: walletAddressInfo.resourceServer,
      accessToken,
    },
    body
  )) as unknown as IncomingPaymentWithPaymentMethods;

  return incomingPayment;
}

/**
 * Get the current state of an incoming payment.
 */
export async function getIncomingPayment(
  url: string,
  accessToken?: string
): Promise<IncomingPayment> {
  const { getPublicClient } = await import("./client");

  if (accessToken) {
    // Requires merchant context — but getPublicClient is unauthenticated
    // For authenticated gets, use the authenticated client
    const client = await getPublicClient();
    return client.incomingPayment.get({ url }) as unknown as IncomingPayment;
  }

  const client = await getPublicClient();
  return (await client.incomingPayment.get({ url })) as unknown as IncomingPayment;
}

/**
 * Mark an incoming payment as complete.
 * Tells the recipient's ASE that no further payments will be sent.
 */
export async function completeIncomingPayment(params: {
  merchantId: string;
  incomingPaymentUrl: string;
  accessToken: string;
}): Promise<IncomingPayment> {
  const keys = await getMerchantPrivateKey(params.merchantId);
  if (!keys) throw new Error("Merchant not found");

  const client = await getMerchantClient(keys);
  return client.incomingPayment.complete({
    url: params.incomingPaymentUrl,
    accessToken: params.accessToken,
  });
}
