import {
  createAuthenticatedClient,
  createUnauthenticatedClient,
  type AuthenticatedClient,
  type UnauthenticatedClient,
} from "@interledger/open-payments";

/**
 * Create an authenticated Open Payments client for a specific merchant.
 * This client signs all requests with the merchant's private key.
 */
export async function getMerchantClient(params: {
  walletAddress: string;
  privateKey: string;
  keyId: string;
}): Promise<AuthenticatedClient> {
  return createAuthenticatedClient({
    walletAddressUrl: params.walletAddress,
    privateKey: params.privateKey,
    keyId: params.keyId,
  });
}

/**
 * Create an unauthenticated client for public operations
 * (e.g., resolving wallet addresses).
 */
export async function getPublicClient(): Promise<UnauthenticatedClient> {
  return createUnauthenticatedClient({
    validateResponses: false,
  });
}
