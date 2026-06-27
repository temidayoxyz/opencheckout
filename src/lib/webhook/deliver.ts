import { and, asc, eq, isNull, lt } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { generateWebhookSignature } from "./signature";
import { generateWebhookEventId } from "@/lib/crypto/ids";
import { assertSafePublicUrl } from "@/lib/crypto/url-validation";
import { decryptStoredSecret } from "@/lib/crypto/keys";

interface DeliverWebhookParams {
  merchantId: string;
  sessionId: string;
  eventType: string;
  payload: Record<string, unknown>;
  webhookUrl: string;
  webhookSecret: string;
}

interface AttemptWebhookParams {
  eventId: string;
  payload: Record<string, unknown>;
  webhookUrl: string;
  webhookSecret: string;
  startingAttempt: number;
  maximumAttempt: number;
}

/** Deliver a new webhook event with immediate exponential-backoff retries. */
export async function deliverWebhook(
  params: DeliverWebhookParams
): Promise<boolean> {
  try {
    await assertSafePublicUrl(params.webhookUrl);
  } catch (error) {
    console.error("Unsafe webhook URL:", error);
    return false;
  }

  const eventId = generateWebhookEventId();
  await getDb().insert(schema.webhookEvents).values({
    id: eventId,
    merchantId: params.merchantId,
    sessionId: params.sessionId,
    eventType: params.eventType,
    payload: params.payload,
    attempts: 0,
  });

  return attemptWebhookDelivery({
    eventId,
    payload: params.payload,
    webhookUrl: params.webhookUrl,
    webhookSecret: params.webhookSecret,
    startingAttempt: 0,
    maximumAttempt: 3,
  });
}

async function attemptWebhookDelivery(
  params: AttemptWebhookParams
): Promise<boolean> {
  await assertSafePublicUrl(params.webhookUrl);

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const payloadStr = JSON.stringify(params.payload);
  const signature = generateWebhookSignature(
    payloadStr,
    params.webhookSecret,
    timestamp
  );

  for (
    let attempt = params.startingAttempt + 1;
    attempt <= params.maximumAttempt;
    attempt++
  ) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(params.webhookUrl, {
        method: "POST",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "OpenCheckout-Signature": `t=${timestamp},v1=${signature}`,
          "User-Agent": "OpenCheckout/1.0",
        },
        body: payloadStr,
      });

      await recordWebhookAttempt(params.eventId, attempt);
      if (response.ok) {
        await getDb()
          .update(schema.webhookEvents)
          .set({ deliveredAt: new Date().toISOString() })
          .where(eq(schema.webhookEvents.id, params.eventId));
        return true;
      }
    } catch (error) {
      console.error(`Webhook attempt ${attempt} failed:`, error);
      await recordWebhookAttempt(params.eventId, attempt);
    } finally {
      clearTimeout(timeout);
    }

    if (attempt < params.maximumAttempt) {
      const delayExponent = Math.min(attempt - params.startingAttempt - 1, 4);
      await new Promise((resolve) =>
        setTimeout(resolve, 1000 * Math.pow(2, delayExponent))
      );
    }
  }

  return false;
}

async function recordWebhookAttempt(eventId: string, attempt: number) {
  await getDb()
    .update(schema.webhookEvents)
    .set({ attempts: attempt, lastAttempt: new Date().toISOString() })
    .where(eq(schema.webhookEvents.id, eventId));
}

/** Retry durable undelivered events. Intended for the maintenance endpoint. */
export async function retryPendingWebhooks(limit = 20): Promise<{
  checked: number;
  delivered: number;
}> {
  const events = await getDb()
    .select()
    .from(schema.webhookEvents)
    .where(
      and(
        isNull(schema.webhookEvents.deliveredAt),
        lt(schema.webhookEvents.attempts, 6)
      )
    )
    .orderBy(asc(schema.webhookEvents.createdAt))
    .limit(limit);

  let delivered = 0;
  for (const event of events) {
    const merchants = await getDb()
      .select()
      .from(schema.merchants)
      .where(eq(schema.merchants.id, event.merchantId))
      .limit(1);
    const merchant = merchants[0];
    if (!merchant?.webhookUrl || !merchant.webhookSecret || !event.payload) {
      continue;
    }

    try {
      const success = await attemptWebhookDelivery({
        eventId: event.id,
        payload: event.payload,
        webhookUrl: merchant.webhookUrl,
        webhookSecret: decryptStoredSecret(merchant.webhookSecret),
        startingAttempt: event.attempts ?? 0,
        maximumAttempt: 6,
      });
      if (success) delivered++;
    } catch (error) {
      console.error(`Webhook replay failed for ${event.id}:`, error);
    }
  }

  return { checked: events.length, delivered };
}

/** Fire a session webhook when the merchant configured a destination. */
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
  if (!merchant?.webhookUrl || !merchant.webhookSecret) return false;

  return deliverWebhook({
    merchantId,
    sessionId,
    eventType,
    payload,
    webhookUrl: merchant.webhookUrl,
    webhookSecret: decryptStoredSecret(merchant.webhookSecret),
  });
}
