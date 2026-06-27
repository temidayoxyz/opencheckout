import type { NextRequest } from "next/server";
import { authenticateApiKey } from "./auth";
import { decryptStoredSecret } from "@/lib/crypto/keys";

export const DASHBOARD_SESSION_COOKIE = "oc_dashboard_session";

export async function authenticateDashboardRequest(request: NextRequest) {
  const sessionKey = request.cookies.get(DASHBOARD_SESSION_COOKIE)?.value;
  if (!sessionKey) return null;
  try {
    return authenticateApiKey(`Bearer ${decryptStoredSecret(sessionKey)}`);
  } catch {
    return null;
  }
}

export function isTrustedDashboardMutation(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    const originUrl = new URL(origin);
    const requestHost =
      firstHeaderValue(
        request.headers.get("x-forwarded-host") ?? request.headers.get("host")
      ) ?? request.nextUrl.host;
    const requestProtocol = firstHeaderValue(
      request.headers.get("x-forwarded-proto") ??
        request.nextUrl.protocol.replace(/:$/, "")
    );

    if (!requestHost || !requestProtocol) return false;
    return (
      originUrl.host === requestHost &&
      originUrl.protocol === `${requestProtocol}:`
    );
  } catch {
    return false;
  }
}

function firstHeaderValue(value: string | null): string | null {
  return value?.split(",", 1)[0]?.trim() || null;
}
