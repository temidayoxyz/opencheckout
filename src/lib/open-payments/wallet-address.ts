import { getPublicClient } from "./client";
import type { WalletAddress } from "@interledger/open-payments";
import { assertSafePublicUrl } from "@/lib/crypto/url-validation";

/**
 * Resolve a wallet address URL to its public information.
 * This is an unauthenticated operation — anyone can look up a wallet address.
 */
export async function resolveWalletAddress(
  walletAddressUrl: string
): Promise<WalletAddress> {
  await assertSafePublicUrl(walletAddressUrl);
  const client = await getPublicClient();
  return client.walletAddress.get({ url: walletAddressUrl });
}

/**
 * Get the public keys (JWKS) for a wallet address.
 * Used to verify that a client is who they claim to be.
 */
export async function getWalletAddressKeys(
  walletAddressUrl: string
): Promise<{ keys: Array<Record<string, unknown>> }> {
  const client = await getPublicClient();
  return client.walletAddress.getKeys({ url: walletAddressUrl });
}

/**
 * Validate that a URL is a valid wallet address by attempting to resolve it.
 * Returns the wallet address info if valid, or null if invalid.
 */
export async function isValidWalletAddress(
  url: string
): Promise<WalletAddress | null> {
  try {
    const walletAddress = await resolveWalletAddress(url);
    if (!walletAddress.id || !walletAddress.authServer) {
      return null;
    }
    return walletAddress;
  } catch (err) {
    console.error("Wallet address resolution failed:", err);
    return null;
  }
}
