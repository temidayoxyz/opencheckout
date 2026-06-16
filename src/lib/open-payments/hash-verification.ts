import { createHash } from "crypto";

/**
 * Verify the interaction hash returned by the authorization server.
 *
 * Per the GNAP / Open Payments specification, the hash is computed as:
 *   SHA-256(clientNonce + "\n" + serverNonce + "\n" + interactRef + "\n" + authServerUrl)
 *
 * Base64-encoded with no padding.
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
  const hashBase = [
    clientNonce,
    serverNonce ?? "",
    interactRef,
    authServerUrl,
  ].join("\n");

  const computed = createHash("sha256").update(hashBase).digest("base64");

  return computed === receivedHash;
}
