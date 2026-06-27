import type { NextRequest } from "next/server";

export function getAppBaseUrl(request: NextRequest): string {
  const configuredBaseUrl = process.env.BASE_URL?.trim();

  if (configuredBaseUrl) {
    try {
      return new URL(configuredBaseUrl).origin;
    } catch {
      // Fall through to the actual request origin when configuration is invalid.
    }
  }

  const host = firstHeaderValue(
    request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  );
  const protocol = firstHeaderValue(
    request.headers.get("x-forwarded-proto") ??
      request.nextUrl.protocol.replace(/:$/, "")
  );

  if (!host || !protocol) return request.nextUrl.origin;

  try {
    return new URL(`${protocol}://${host}`).origin;
  } catch {
    return request.nextUrl.origin;
  }
}

function firstHeaderValue(value: string | null): string | null {
  return value?.split(",", 1)[0]?.trim() || null;
}
