import { createHash } from "crypto";

/**
 * Verify the interaction hash returned by the authorization server.
 *
 * Per the GNAP / Open Payments specification, the hash is computed as:
 *   SHA-256(clientNonce + "\n" + serverNonce + "\n" + interactRef + "\n" + authServerUrl)
 *
 * Base64-encoded. Some authorization servers include padding while others
 * follow the unpadded text in the spec, so comparison normalizes both forms.
 */
export function verifyInteractionHash(params: {
  clientNonce: string;
  serverNonce: string | null;
  interactRef: string;
  authServerUrl: string;
  receivedHash: string;
}): boolean {
  const { clientNonce, serverNonce, interactRef, authServerUrl, receivedHash } =
    params;

  // Server nonce might not be present in all implementations
  const serverNonceValue = serverNonce ?? "";
  const authServerUrlVariants = authServerUrl.endsWith("/")
    ? [authServerUrl, authServerUrl.slice(0, -1)]
    : [authServerUrl, `${authServerUrl}/`];

  const received = normalizeHash(receivedHash);

  return authServerUrlVariants.some((authServerUrlVariant) => {
    const hashBase = [
      clientNonce,
      serverNonceValue,
      interactRef,
      authServerUrlVariant,
    ].join("\n");

    const computed = createHash("sha256").update(hashBase).digest("base64");

    return normalizeHash(computed) === received;
  });
}

function normalizeHash(value: string): string {
  return value.replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/g, "");
}
