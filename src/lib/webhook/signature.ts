import { createHmac, timingSafeEqual } from "crypto";

/**
 * Generate a signature for a webhook payload.
 * Uses HMAC-SHA256 with the merchant's webhook secret.
 *
 * The signature is sent in the `OpenCheckout-Signature` header.
 * Merchants verify it to ensure the webhook came from OpenCheckout.
 */
export function generateWebhookSignature(
  payload: string,
  secret: string,
  timestamp: string
): string {
  const signedPayload = `${timestamp}.${payload}`;
  return createHmac("sha256", secret)
    .update(signedPayload, "utf8")
    .digest("hex");
}

/**
 * Verify a webhook signature.
 * Uses constant-time comparison to prevent timing attacks.
 */
export function verifyWebhookSignature(
  payload: string,
  secret: string,
  signature: string,
  timestamp: string
): boolean {
  const expected = generateWebhookSignature(payload, secret, timestamp);
  try {
    const sigBuf = Buffer.from(signature, "hex");
    const expectedBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expectedBuf.length) return false;
    return timingSafeEqual(sigBuf, expectedBuf);
  } catch {
    return false;
  }
}
