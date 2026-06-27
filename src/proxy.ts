import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function getAllowedCorsOrigin(request: NextRequest): string | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;

  const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return allowedOrigins.includes(origin) ? origin : null;
}

function applyCorsHeaders(response: NextResponse, origin: string) {
  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Idempotency-Key"
  );
  response.headers.set("Access-Control-Max-Age", "86400");
  response.headers.append("Vary", "Origin");
}

function setSecurityHeaders(response: NextResponse) {
  const isDevelopment = process.env.NODE_ENV === "development";
  const scriptSources = ["'self'", "'unsafe-inline'"];
  if (isDevelopment) scriptSources.push("'unsafe-eval'");

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  );
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      `script-src ${scriptSources.join(" ")}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https:",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
    ].join("; ")
  );

  if (!isDevelopment) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
  }

  return response;
}

export function proxy(request: NextRequest) {
  const isCheckoutApi = request.nextUrl.pathname.startsWith("/api/checkout");
  const requestOrigin = request.headers.get("origin");
  const allowedOrigin = isCheckoutApi ? getAllowedCorsOrigin(request) : null;

  if (isCheckoutApi && request.method === "OPTIONS") {
    if (requestOrigin && !allowedOrigin) {
      return setSecurityHeaders(new NextResponse(null, { status: 403 }));
    }

    const response = new NextResponse(null, { status: 204 });
    if (allowedOrigin) applyCorsHeaders(response, allowedOrigin);
    return setSecurityHeaders(response);
  }

  const response = setSecurityHeaders(NextResponse.next());
  if (allowedOrigin) applyCorsHeaders(response, allowedOrigin);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|opengraph-image.png).*)",
  ],
};
