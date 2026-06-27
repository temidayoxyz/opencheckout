import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/merchant/auth";
import {
  authenticateDashboardRequest,
  DASHBOARD_SESSION_COOKIE,
  isTrustedDashboardMutation,
} from "@/lib/merchant/dashboard-auth";
import { checkRateLimit, getRequestClientKey } from "@/lib/http/rate-limit";
import { encryptStoredSecret } from "@/lib/crypto/keys";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

export async function GET(request: NextRequest) {
  const merchant = await authenticateDashboardRequest(request);
  return noStore(
    NextResponse.json(
      merchant
        ? { authenticated: true, merchant: { id: merchant.id, name: merchant.name } }
        : { authenticated: false },
      { status: merchant ? 200 : 401 }
    )
  );
}

export async function POST(request: NextRequest) {
  if (!isTrustedDashboardMutation(request)) {
    return NextResponse.json(
      { error: { message: "Invalid request origin" } },
      { status: 403 }
    );
  }

  const rateLimit = checkRateLimit(
    `dashboard-login:${getRequestClientKey(request)}`,
    { limit: 10, windowMs: 15 * 60 * 1000 }
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: { message: "Too many sign-in attempts. Try again later." } },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      }
    );
  }

  let body: { api_key?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { message: "Invalid JSON body" } },
      { status: 400 }
    );
  }

  const apiKey = body.api_key?.trim();
  const merchant = await authenticateApiKey(
    apiKey ? `Bearer ${apiKey}` : null
  );
  if (!merchant || !apiKey) {
    return noStore(
      NextResponse.json(
        { error: { message: "Invalid API key" } },
        { status: 401 }
      )
    );
  }

  const response = NextResponse.json({
    authenticated: true,
    merchant: { id: merchant.id, name: merchant.name },
  });
  response.cookies.set(DASHBOARD_SESSION_COOKIE, encryptStoredSecret(apiKey), {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:" || process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return noStore(response);
}

export async function DELETE(request: NextRequest) {
  if (!isTrustedDashboardMutation(request)) {
    return NextResponse.json(
      { error: { message: "Invalid request origin" } },
      { status: 403 }
    );
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(DASHBOARD_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:" || process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return noStore(response);
}

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store");
  return response;
}
