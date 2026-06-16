import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/merchant/auth";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { generateWebhookSecret } from "@/lib/crypto/hmac";
import { isSafePublicUrl } from "@/lib/crypto/url-validation";

/**
 * GET /api/dashboard/settings
 * Get merchant settings (webhook URL, webhook secret masked).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const merchant = await authenticateApiKey(authHeader);
  if (!merchant) {
    return NextResponse.json(
      { error: { message: "Invalid API key" } },
      { status: 401 }
    );
  }

  return NextResponse.json({
    webhook_url: merchant.webhookUrl ?? "",
    webhook_secret_masked: merchant.webhookSecret
      ? `${merchant.webhookSecret.substring(0, 8)}...`
      : "",
  });
}

/**
 * POST /api/dashboard/settings
 * Update merchant settings (webhook URL, regenerate secret).
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const merchant = await authenticateApiKey(authHeader);
  if (!merchant) {
    return NextResponse.json(
      { error: { message: "Invalid API key" } },
      { status: 401 }
    );
  }

  let body: { webhook_url?: string; regenerate_secret?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { message: "Invalid JSON body" } },
      { status: 400 }
    );
  }

  const updates: Record<string, string> = {};
  let newSecret: string | null = null;

  if (body.webhook_url !== undefined) {
    if (body.webhook_url !== "" && !isSafePublicUrl(body.webhook_url)) {
      return NextResponse.json(
        { error: { message: "Invalid webhook URL. Must be a public HTTPS URL." } },
        { status: 400 }
      );
    }
    updates.webhookUrl = body.webhook_url;
  }

  if (body.regenerate_secret) {
    newSecret = generateWebhookSecret();
    updates.webhookSecret = newSecret;
  }

  if (Object.keys(updates).length > 0) {
    await getDb()
      .update(schema.merchants)
      .set(updates)
      .where(eq(schema.merchants.id, merchant.id));
  }

  return NextResponse.json({
    webhook_url: updates.webhookUrl ?? merchant.webhookUrl ?? "",
    ...(newSecret ? { webhook_secret: newSecret } : {}),
    success: true,
  });
}
