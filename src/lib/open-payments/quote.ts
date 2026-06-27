import type { Quote } from "@interledger/open-payments";
import { getMerchantClient } from "./client";
import { getMerchantPrivateKey } from "@/lib/merchant/onboarding";
import { resolveWalletAddress } from "./wallet-address";

interface CreateQuoteFromIncomingAmountParams {
  merchantId: string;
  receiver: string; // URL of the incoming payment
  walletAddress: string; // customer's wallet address (sender)
}

interface CreateQuoteWithDebitAmountParams {
  merchantId: string;
  receiver: string;
  walletAddress: string;
  debitAmount: {
    value: string;
    assetCode: string;
    assetScale: number;
  };
}

interface CreateQuoteWithReceiveAmountParams {
  merchantId: string;
  receiver: string;
  walletAddress: string;
  receiveAmount: {
    value: string;
    assetCode: string;
    assetScale: number;
  };
}

type CreateQuoteParams =
  | ({ type: "incoming-amount" } & CreateQuoteFromIncomingAmountParams)
  | ({ type: "debit-amount" } & CreateQuoteWithDebitAmountParams)
  | ({ type: "receive-amount" } & CreateQuoteWithReceiveAmountParams);

/**
 * Create a quote on the sender's (customer's) ASE.
 * Returns the quote with exchange rate, fees, and debit/receive amounts.
 *
 * Once created, a quote is a commitment from the sender's ASE
 * to deliver a specific amount. Quotes expire.
 */
export async function createQuote(params: CreateQuoteParams): Promise<Quote> {
  const keys = await getMerchantPrivateKey(params.merchantId);
  if (!keys) throw new Error("Merchant not found");

  // Get sender wallet address info to discover their resource server
  const senderWallet = await resolveWalletAddress(params.walletAddress);
  // We need to request a quote grant from the sender's auth server
  // But the sender is the customer, not the merchant. The merchant's client
  // requests the quote on behalf of the customer.
  //
  // For the quote, we use the merchant's client to request a quote grant
  // from the sender's auth server. This is a non-interactive grant.
  const client = await getMerchantClient(keys);

  const grant = await client.grant.request(
    { url: senderWallet.authServer },
    {
      access_token: {
        access: [
          {
            type: "quote",
            actions: ["create", "read"],
          },
        ],
      },
    }
  );

  const { isFinalizedGrantWithAccessToken } = await import(
    "@interledger/open-payments"
  );
  if (!isFinalizedGrantWithAccessToken(grant)) {
    throw new Error("Expected finalized quote grant");
  }

  const accessToken = grant.access_token.value;

  // Build the quote body
  const baseBody = {
    method: "ilp" as const,
    walletAddress: params.walletAddress,
    receiver: params.receiver,
  };

  const body: {
    method: "ilp";
    walletAddress: string;
    receiver: string;
    debitAmount?: { value: string; assetCode: string; assetScale: number };
    receiveAmount?: { value: string; assetCode: string; assetScale: number };
  } = { ...baseBody };

  switch (params.type) {
    case "incoming-amount":
      break;
    case "debit-amount":
      body.debitAmount = params.debitAmount;
      break;
    case "receive-amount":
      body.receiveAmount = params.receiveAmount;
      break;
  }

  const quote = await client.quote.create(
    {
      url: senderWallet.resourceServer,
      accessToken,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body as any
  );

  return quote;
}

/**
 * Get a quote by URL.
 */
export async function getQuote(
  url: string,
  accessToken: string,
  merchantId: string
): Promise<Quote> {
  const keys = await getMerchantPrivateKey(merchantId);
  if (!keys) throw new Error("Merchant not found");

  const client = await getMerchantClient(keys);
  return client.quote.get({ url, accessToken });
}
