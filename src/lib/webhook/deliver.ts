import { getDb, schema } from "@/lib/db";
import { generateWebhookSignature } from "./signature";
import { generateWebhookEventId } from "@/lib/crypto/ids";
import { eq } from "drizzle-orm";

interface DeliverWebhookParams {
  merchantId: string;
  sessionId: string;
  eventType: string;
  payload: Record<string, unknown>;
  webhookUrl: string;
  webhookSecret: string;
}

/**
 * Deliver a webhook event to a merchant's webhook URL.
 * Retries with exponential backoff on failure.
 */
export async function deliverWebhook(params: DeliverWebhookParams): Promise<boolean> {
  const eventId = generateWebhookEventId();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const payloadStr = JSON.stringify(params.payload);
  const signature = generateWebhookSignature(
    payloadStr,
    params.webhookSecret,
    timestamp
  );

  // Create webhook event record
  await getDb().insert(schema.webhookEvents).values({
    id: eventId,
    merchantId: params.merchantId,
    sessionId: params.sessionId,
    eventType: params.eventType,
    payload: params.payload,
    attempts: 0,
  });

  // Attempt delivery with retries
  const maxRetries = 3;
  const baseDelay = 1000; // 1 second

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(params.webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "OpenCheckout-Signature": `t=${timestamp},v1=${signature}`,
          "User-Agent": "OpenCheckout/1.0",
        },
        body: payloadStr,
      });

      // Update attempt count
      await getDb()
        .update(schema.webhookEvents)
        .set({
          attempts: attempt,
          lastAttempt: new Date().toISOString(),
        })
        .where(eq(schema.webhookEvents.id, eventId));

      if (response.ok) {
        // Mark as delivered
        await getDb()
          .update(schema.webhookEvents)
          .set({ deliveredAt: new Date().toISOString() })
          .where(eq(schema.webhookEvents.id, eventId));
        return true;
      }

      // If not successful, wait before retry
      if (attempt < maxRetries) {
        await new Promise((resolve) =>
          setTimeout(resolve, baseDelay * Math.pow(2, attempt - 1))
        );
      }
    } catch {
      // Network error — retry
      await getDb()
        .update(schema.webhookEvents)
        .set({
          attempts: attempt,
          lastAttempt: new Date().toISOString(),
        })
        .where(eq(schema.webhookEvents.id, eventId));

      if (attempt < maxRetries) {
        await new Promise((resolve) =>
          setTimeout(resolve, baseDelay * Math.pow(2, attempt - 1))
        );
      }
    }
  }

  return false;
}

/**
 * Fire a webhook for a session state change.
 * Looks up the merchant's webhook config and delivers the event.
 */
export async function fireSessionWebhook(
  merchantId: string,
  sessionId: string,
  eventType: string,
  payload: Record<string, unknown>
): Promise<boolean> {
  const merchants = await getDb()
    .select()
    .from(schema.merchants)
    .where(eq(schema.merchants.id, merchantId))
    .limit(1);

  const merchant = merchants[0];
  if (!merchant?.webhookUrl || !merchant?.webhookSecret) {
    return false; // No webhook configured
  }

  return deliverWebhook({
    merchantId,
    sessionId,
    eventType,
    payload,
    webhookUrl: merchant.webhookUrl,
    webhookSecret: merchant.webhookSecret,
  });
}
