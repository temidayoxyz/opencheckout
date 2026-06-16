import { createHash } from "crypto";
import { eq, lt } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

/**
 * Hash an idempotency key for storage.
 */
function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Check if an idempotency key has already been used.
 * Returns the cached response if found and not expired, otherwise null.
 */
export async function checkIdempotencyKey(
  idempotencyKey: string,
  merchantId: string
): Promise<{ statusCode: number; response: Record<string, unknown> } | null> {
  const keyHash = hashKey(idempotencyKey);

  const results = await getDb()
    .select()
    .from(schema.idempotencyKeys)
    .where(eq(schema.idempotencyKeys.keyHash, keyHash))
    .limit(1);

  const record = results[0];
  if (!record) return null;

  // Verify the key belongs to the same merchant
  if (record.merchantId !== merchantId) return null;

  // Check expiry (24h)
  const createdAt = new Date(record.createdAt);
  if (Date.now() - createdAt.getTime() > 86400000) return null;

  return {
    statusCode: record.statusCode,
    response: record.response as Record<string, unknown>,
  };
}

/**
 * Store a response for an idempotency key so future
 * requests with the same key return the same response.
 */
export async function saveIdempotencyKey(
  idempotencyKey: string,
  merchantId: string,
  sessionId: string,
  response: Record<string, unknown>,
  statusCode: number
): Promise<void> {
  const keyHash = hashKey(idempotencyKey);

  await getDb()
    .insert(schema.idempotencyKeys)
    .values({
      keyHash,
      merchantId,
      sessionId,
      response,
      statusCode,
    });
}

/**
 * Clean up expired idempotency keys (older than 24h).
 */
export async function cleanExpiredIdempotencyKeys(): Promise<number> {
  const cutoff = new Date(Date.now() - 86400000).toISOString();

  const result = await getDb()
    .delete(schema.idempotencyKeys)
    .where(lt(schema.idempotencyKeys.createdAt, cutoff));

  return result.changes;
}
