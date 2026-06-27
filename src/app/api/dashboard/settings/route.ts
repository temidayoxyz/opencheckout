import { NextRequest, NextResponse } from "next/server";
import {
  authenticateDashboardRequest,
  isTrustedDashboardMutation,
} from "@/lib/merchant/dashboard-auth";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { generateWebhookSecret } from "@/lib/crypto/hmac";
import { assertSafePublicUrl } from "@/lib/crypto/url-validation";
import {
  decryptStoredSecret,
  encryptStoredSecret,
} from "@/lib/crypto/keys";

/**
 * GET /api/dashboard/settings
 * Get merchant settings (webhook URL, webhook secret masked).
 */
export async function GET(request: NextRequest) {
  const merchant = await authenticateDashboardRequest(request);
  if (!merchant) {
    return NextResponse.json(
      { error: { message: "Invalid API key" } },
      { status: 401 }
    );
  }

  return NextResponse.json({
    webhook_url: merchant.webhookUrl ?? "",
    webhook_secret_masked: merchant.webhookSecret
      ? `${decryptStoredSecret(merchant.webhookSecret).substring(0, 8)}...`
      : "",
  });
}

/**
 * POST /api/dashboard/settings
 * Update merchant settings (webhook URL, regenerate secret).
 */
export async function POST(request: NextRequest) {
  if (!isTrustedDashboardMutation(request)) {
    return NextResponse.json(
      { error: { message: "Invalid request origin" } },
      { status: 403 }
    );
  }

  const merchant = await authenticateDashboardRequest(request);
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
    if (body.webhook_url !== "") {
      try {
        await assertSafePublicUrl(body.webhook_url);
      } catch (error) {
        return NextResponse.json(
          {
            error: {
              message:
                error instanceof Error
                  ? error.message
                  : "Invalid webhook URL. Must be a public HTTPS URL.",
            },
          },
          { status: 400 }
        );
      }
    }
    updates.webhookUrl = body.webhook_url;
  }

  if (body.regenerate_secret) {
    newSecret = generateWebhookSecret();
    updates.webhookSecret = encryptStoredSecret(newSecret);
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
