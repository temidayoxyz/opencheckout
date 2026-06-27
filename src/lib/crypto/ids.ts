import { customAlphabet } from "nanoid";

// URL-safe alphabet for session IDs
const alphabet =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const nanoid = customAlphabet(alphabet, 16);

/**
 * Generate an OpenCheckout session ID (e.g., cs_a1b2c3d4e5f6g7h8)
 */
export function generateSessionId(): string {
  return `cs_${nanoid()}`;
}

/**
 * Generate a merchant ID
 */
export function generateMerchantId(): string {
  return `mer_${nanoid(12)}`;
}

/**
 * Generate an API key ID
 */
export function generateApiKeyId(): string {
  return `ak_${nanoid(10)}`;
}

/**
 * Generate a webhook event ID
 */
export function generateWebhookEventId(): string {
  return `we_${nanoid(14)}`;
}

/**
 * Generate a random nonce for grant requests
 */
export function generateNonce(): string {
  return crypto.randomUUID().replace(/-/g, "");
}
