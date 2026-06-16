import type {
  OutgoingPayment,
  OutgoingPaymentWithSpentAmounts,
} from "@interledger/open-payments";
import { getMerchantClient } from "./client";
import { getMerchantPrivateKey } from "@/lib/merchant/onboarding";
import { resolveWalletAddress } from "./wallet-address";

interface CreateOutgoingPaymentParams {
  merchantId: string;
  customerWalletAddress: string;
  accessToken: string; // From the outgoing payment grant
  quoteId?: string; // URL of the quote (if a quote was created)
  incomingPaymentUrl?: string; // URL of the incoming payment
  debitAmount?: {
    value: string;
    assetCode: string;
    assetScale: number;
  };
  metadata?: Record<string, unknown>;
}

/**
 * Create an outgoing payment on the customer's account.
 * This is the final step — it issues the payment instruction.
 *
 * The outgoing payment can reference a quoteId (recommended)
 * OR specify debitAmount + incomingPaymentUrl directly.
 */
export async function createOutgoingPayment(
  params: CreateOutgoingPaymentParams
): Promise<OutgoingPaymentWithSpentAmounts> {
  const keys = await getMerchantPrivateKey(params.merchantId);
  if (!keys) throw new Error("Merchant not found");

  const customerWallet = await resolveWalletAddress(
    params.customerWalletAddress
  );

  const client = await getMerchantClient(keys);

  const body: Record<string, unknown> = {
    walletAddress: params.customerWalletAddress,
  };

  if (params.quoteId) {
    body.quoteId = params.quoteId;
  } else if (params.incomingPaymentUrl && params.debitAmount) {
    body.incomingPayment = params.incomingPaymentUrl;
    body.debitAmount = params.debitAmount;
  } else {
    throw new Error(
      "Either quoteId or (incomingPaymentUrl + debitAmount) is required"
    );
  }

  if (params.metadata) {
    body.metadata = params.metadata;
  }

  const outgoingPayment = (await client.outgoingPayment.create(
    {
      url: customerWallet.resourceServer,
      accessToken: params.accessToken,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body as any
  )) as unknown as OutgoingPaymentWithSpentAmounts;

  return outgoingPayment;
}

/**
 * Get an outgoing payment by URL.
 */
export async function getOutgoingPayment(
  url: string,
  accessToken: string,
  merchantId: string
): Promise<OutgoingPayment> {
  const keys = await getMerchantPrivateKey(merchantId);
  if (!keys) throw new Error("Merchant not found");

  const client = await getMerchantClient(keys);
  return client.outgoingPayment.get({ url, accessToken });
}
