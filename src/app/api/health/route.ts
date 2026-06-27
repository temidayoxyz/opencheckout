import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

const startTime = Date.now();

/**
 * GET /api/health
 * Health check endpoint for uptime monitoring.
 * Returns service status and uptime.
 */
export async function GET() {
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

  try {
    await getDb().run(sql`select 1`);
    return NextResponse.json({
      status: "healthy",
      database: "ready",
      uptime: uptimeSeconds,
      version: "0.1.0",
    });
  } catch (error) {
    console.error("Health check failed:", error);
    return NextResponse.json(
      {
        status: "unhealthy",
        database: "unavailable",
        uptime: uptimeSeconds,
        version: "0.1.0",
      },
      { status: 503 }
    );
  }
}
