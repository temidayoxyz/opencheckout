import { createHash, randomBytes } from "crypto";
import { eq, and, isNull } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

/**
 * Hash an API key using SHA-256 for storage.
 */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Generate a new API key (sk_xxx prefix + random).
 * Returns both the plaintext key (shown once) and the hash (stored).
 */
export function generateApiKey(): { plaintext: string; hash: string } {
  const random = randomBytes(32).toString("base64url");
  const key = `sk_${random}`;
  return { plaintext: key, hash: hashApiKey(key) };
}

/**
 * Authenticate a request using the Authorization header.
 * Expects: `Authorization: Bearer sk_xxx`
 * Returns the merchant record if valid, null otherwise.
 */
export async function authenticateApiKey(
  authHeader: string | null
): Promise<typeof schema.merchants.$inferSelect | null> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const key = authHeader.slice(7).trim();
  if (!key.startsWith("sk_")) {
    return null;
  }

  const hash = hashApiKey(key);

  const result = await getDb()
    .select({
      apiKey: schema.apiKeys,
      merchant: schema.merchants,
    })
    .from(schema.apiKeys)
    .innerJoin(
      schema.merchants,
      eq(schema.apiKeys.merchantId, schema.merchants.id)
    )
    .where(and(eq(schema.apiKeys.keyHash, hash), isNull(schema.apiKeys.revokedAt)))
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  return result[0].merchant;
}

/**
 * API key record for insertion.
 */
export type InsertApiKey = typeof schema.apiKeys.$inferInsert;
