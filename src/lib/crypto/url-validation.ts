import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const BLOCKED_HOSTNAMES = new Set(["localhost", "localhost.localdomain"]);

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return false;
  }

  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51) ||
    (a === 203 && b === 0) ||
    a >= 224
  );
}

function isPrivateIpv6(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  if (normalized.startsWith("::ffff:")) {
    return isPrivateIpv4(normalized.slice("::ffff:".length));
  }

  const firstSegment = Number.parseInt(normalized.split(":")[0] || "0", 16);
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    (firstSegment >= 0xfe80 && firstSegment <= 0xfebf)
  );
}

export function isPrivateAddress(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const ipVersion = isIP(normalized);

  if (ipVersion === 4) return isPrivateIpv4(normalized);
  if (ipVersion === 6) return isPrivateIpv6(normalized);
  return false;
}

/**
 * Fast syntactic public URL check. Use assertSafePublicUrl before network I/O.
 */
export function isSafePublicUrl(url: string, httpsOnly = true): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.username || parsed.password) return false;
    if (httpsOnly && parsed.protocol !== "https:") return false;
    if (!httpsOnly && parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();
    if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith(".localhost")) {
      return false;
    }

    return !isPrivateAddress(hostname);
  } catch {
    return false;
  }
}

/**
 * Resolve DNS and reject private/reserved results before making server-side
 * network requests. This closes the easy SSRF holes left by hostname-only
 * checks. Callers should still use timeouts and avoid following redirects.
 */
export async function assertSafePublicUrl(
  url: string,
  options: { httpsOnly?: boolean } = {}
): Promise<URL> {
  const httpsOnly = options.httpsOnly ?? true;
  if (!isSafePublicUrl(url, httpsOnly)) {
    throw new Error("URL must be a public HTTPS URL");
  }

  const parsed = new URL(url);
  const addresses = await lookup(parsed.hostname, { all: true, verbatim: true });
  if (addresses.length === 0) {
    throw new Error("URL host could not be resolved");
  }

  if (addresses.some((address) => isPrivateAddress(address.address))) {
    throw new Error("URL resolves to a private or reserved address");
  }

  return parsed;
}
