import { createHash } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

export type IdempotencyLookup =
  | { state: "reserved" }
  | { state: "cached"; statusCode: number; response: Record<string, unknown> }
  | { state: "mismatch" }
  | { state: "in_progress" };

/**
 * Hash the merchant id into the key so different merchants can safely reuse
 * the same Idempotency-Key value without colliding.
 */
function hashKey(idempotencyKey: string, merchantId: string): string {
  return createHash("sha256")
    .update(`${merchantId}:${idempotencyKey}`)
    .digest("hex");
}

export function hashRequestBody(body: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(body))
    .digest("hex");
}

/**
 * Reserve an idempotency key before doing work. A concurrent duplicate will
 * see the reservation and will not create a second checkout session.
 */
export async function reserveIdempotencyKey(
  idempotencyKey: string,
  merchantId: string,
  requestHash: string
): Promise<IdempotencyLookup> {
  await cleanExpiredIdempotencyKeys();

  const keyHash = hashKey(idempotencyKey, merchantId);

  const inserted = await getDb()
    .insert(schema.idempotencyKeys)
    .values({ keyHash, merchantId, requestHash })
    .onConflictDoNothing()
    .returning({ keyHash: schema.idempotencyKeys.keyHash });

  if (inserted.length > 0) {
    return { state: "reserved" };
  }

  const results = await getDb()
    .select()
    .from(schema.idempotencyKeys)
    .where(eq(schema.idempotencyKeys.keyHash, keyHash))
    .limit(1);

  const record = results[0];
  if (!record) return { state: "in_progress" };

  if (record.requestHash !== requestHash) {
    return { state: "mismatch" };
  }

  if (record.response && record.statusCode) {
    return {
      state: "cached",
      statusCode: record.statusCode,
      response: record.response as Record<string, unknown>,
    };
  }

  return { state: "in_progress" };
}

/**
 * Store a final response for an already-reserved idempotency key.
 */
export async function completeIdempotencyKey(
  idempotencyKey: string,
  merchantId: string,
  sessionId: string,
  response: Record<string, unknown>,
  statusCode: number
): Promise<void> {
  const keyHash = hashKey(idempotencyKey, merchantId);

  await getDb()
    .update(schema.idempotencyKeys)
    .set({
      sessionId,
      response,
      statusCode,
    })
    .where(eq(schema.idempotencyKeys.keyHash, keyHash));
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
