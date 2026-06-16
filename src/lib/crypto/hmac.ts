import { createHmac, timingSafeEqual, randomBytes } from "crypto";

/**
 * Generate a webhook secret for a merchant.
 * Returns a hex-encoded 32-byte random secret.
 */
export function generateWebhookSecret(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Sign a webhook payload with HMAC-SHA256.
 * Returns the signature as a hex string.
 */
export function signWebhookPayload(
  payload: string,
  secret: string
): string {
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

/**
 * Verify a webhook signature in constant time.
 * Uses timingSafeEqual to prevent timing attacks.
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = signWebhookPayload(payload, secret);
  const sigBuf = Buffer.from(signature, "hex");
  const expectedBuf = Buffer.from(expected, "hex");

  if (sigBuf.length !== expectedBuf.length) {
    return false;
  }
  return timingSafeEqual(sigBuf, expectedBuf);
}

/**
 * Sign session redirect parameters to prevent tampering.
 * Used to validate that a redirect back from ASE is authentic.
 */
export function signSessionRedirect(
  sessionId: string,
  secret: string
): string {
  return createHmac("sha256", secret)
    .update(sessionId, "utf8")
    .digest("hex")
    .substring(0, 16);
}

/**
 * Verify a session redirect signature.
 */
export function verifySessionRedirect(
  sessionId: string,
  signature: string,
  secret: string
): boolean {
  const expected = signSessionRedirect(sessionId, secret);
  try {
    return timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expected, "hex")
    );
  } catch {
    return false;
  }
}
