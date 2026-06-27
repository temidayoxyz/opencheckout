import {
  isPendingGrant,
  isFinalizedGrantWithAccessToken,
  type PendingGrant,
  type GrantWithAccessToken,
} from "@interledger/open-payments";
import { getMerchantClient } from "./client";
import { getMerchantPrivateKey } from "@/lib/merchant/onboarding";
import { resolveWalletAddress } from "./wallet-address";

interface RequestOutgoingPaymentGrantParams {
  merchantId: string;
  customerWalletAddress: string;
  debitAmount?: {
    value: string;
    assetCode: string;
    assetScale: number;
  };
  finishRedirectUri: string;
  nonce: string;
}

/**
 * Request an interactive outgoing payment grant from the sender's
 * (customer's) authorization server.
 *
 * This returns a redirect URL that the customer must visit
 * to approve the payment at their ASE's identity provider.
 *
 * After approval, the grant continuation flow completes
 * and returns an access token.
 */
export interface OutgoingPaymentGrantResult {
  pendingGrant: PendingGrant;
  clientNonce: string;
  serverNonce: string | null;
  authServerUrl: string;
}

export async function requestOutgoingPaymentGrant(
  params: RequestOutgoingPaymentGrantParams
): Promise<OutgoingPaymentGrantResult> {
  const keys = await getMerchantPrivateKey(params.merchantId);
  if (!keys) throw new Error("Merchant not found");

  // Resolve customer's wallet to find their auth server
  const customerWallet = await resolveWalletAddress(
    params.customerWalletAddress
  );

  const client = await getMerchantClient(keys);

  const accessItem: Record<string, unknown> = {
    type: "outgoing-payment",
    actions: ["create", "read", "read-all", "list", "list-all"],
    identifier: customerWallet.id,
  };

  if (params.debitAmount) {
    accessItem.limits = {
      debitAmount: params.debitAmount,
    };
  }

  const grant = await client.grant.request(
    { url: customerWallet.authServer },
    {
      access_token: {
        access: [accessItem] as unknown as Array<{
          type: "outgoing-payment";
          actions: Array<
            "create" | "read" | "read-all" | "list" | "list-all"
          >;
          identifier: string;
        }>,
      },
      interact: {
        start: ["redirect"],
        finish: {
          method: "redirect",
          uri: params.finishRedirectUri,
          nonce: params.nonce,
        },
      },
    }
  );

  if (!isPendingGrant(grant)) {
    throw new Error(
      "Expected a pending/interactive grant for outgoing payment"
    );
  }

  // The authorization server returns its interaction nonce as
  // `interact.finish`. This value must be stored and used when verifying the
  // hash on the redirect callback.
  const serverNonce = grant.interact.finish;

  return {
    pendingGrant: grant,
    clientNonce: params.nonce,
    serverNonce,
    authServerUrl: customerWallet.authServer,
  };
}

interface ContinueGrantParams {
  merchantId: string;
  continueAccessToken: string;
  continueUri: string;
  interactRef: string;
}

/**
 * Continue an interactive grant after the customer has approved
 * the payment at their ASE.
 *
 * Returns the finalized grant with the access token needed
 * to create the outgoing payment.
 */
export async function continueGrant(
  params: ContinueGrantParams
): Promise<GrantWithAccessToken> {
  const keys = await getMerchantPrivateKey(params.merchantId);
  if (!keys) throw new Error("Merchant not found");

  const client = await getMerchantClient(keys);

  const grant = await client.grant.continue(
    {
      accessToken: params.continueAccessToken,
      url: params.continueUri,
    },
    {
      interact_ref: params.interactRef,
    }
  );

  if (!isFinalizedGrantWithAccessToken(grant)) {
    throw new Error(
      "Expected finalized grant with access token after continuation"
    );
  }

  return grant;
}

/**
 * Cancel a grant (revoke authorization).
 */
export async function cancelGrant(params: {
  merchantId: string;
  accessToken: string;
  manageUrl: string;
}): Promise<void> {
  const keys = await getMerchantPrivateKey(params.merchantId);
  if (!keys) throw new Error("Merchant not found");

  const client = await getMerchantClient(keys);
  await client.grant.cancel({
    accessToken: params.accessToken,
    url: params.manageUrl,
  });
}
