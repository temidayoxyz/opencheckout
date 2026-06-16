import { isIP } from "net";

/**
 * Check if a URL is safe for public use (not internal/private).
 *
 * Blocks:
 * - javascript: and data: protocols
 * - File and ftp protocols
 * - Localhost and loopback addresses
 * - Private network IPs (10.x, 172.16-31.x, 192.168.x)
 * - Link-local addresses (169.254.x.x)
 */
export function isSafePublicUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    // Must be https (or http for local dev)
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();

    // Block localhost
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
      return false;
    }

    // Block private and reserved IPs
    if (isIP(hostname)) {
      const parts = hostname.split(".").map(Number);

      // 10.0.0.0/8
      if (parts[0] === 10) return false;

      // 172.16.0.0/12
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false;

      // 192.168.0.0/16
      if (parts[0] === 192 && parts[1] === 168) return false;

      // 169.254.0.0/16 (link-local)
      if (parts[0] === 169 && parts[1] === 254) return false;

      // 0.0.0.0/8
      if (parts[0] === 0) return false;

      // 127.0.0.0/8 (loopback)
      if (parts[0] === 127) return false;
    }

    return true;
  } catch {
    return false;
  }
}
