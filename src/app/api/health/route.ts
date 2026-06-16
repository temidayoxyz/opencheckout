import { NextResponse } from "next/server";

const startTime = Date.now();

/**
 * GET /api/health
 * Health check endpoint for uptime monitoring.
 * Returns service status and uptime.
 */
export function GET() {
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

  return NextResponse.json({
    status: "healthy",
    uptime: uptimeSeconds,
    version: "0.1.0",
  });
}
