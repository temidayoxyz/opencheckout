import { getDb, schema } from "@/lib/db";
import { generateApiKey, hashApiKey } from "./auth";
import { encryptPrivateKey } from "@/lib/crypto/keys";
import {
  generateMerchantId,
  generateApiKeyId,
  generateWebhookEventId,
} from "@/lib/crypto/ids";
import { generateWebhookSecret } from "@/lib/crypto/hmac";
import { eq } from "drizzle-orm";

interface OnboardMerchantParams {
  name: string;
  walletAddress: string;
  privateKey: string; // plaintext Ed25519 private key
  keyId: string;
}

/**
 * Create a new merchant with encrypted private key and initial API key.
 * Returns the plaintext API key (shown only once).
 */
export async function onboardMerchant(
  params: OnboardMerchantParams
): Promise<{ merchantId: string; apiKey: string }> {
  // Encrypt the private key before storing
  const encryptedKey = encryptPrivateKey(params.privateKey);
  const merchantId = generateMerchantId();
  const webhookSecret = generateWebhookSecret();

  await getDb().insert(schema.merchants).values({
    id: merchantId,
    name: params.name,
    walletAddress: params.walletAddress,
    privateKey: encryptedKey,
    keyId: params.keyId,
    webhookSecret,
  });

  // Generate initial API key
  const { plaintext, hash } = generateApiKey();
  await getDb().insert(schema.apiKeys).values({
    id: generateApiKeyId(),
    merchantId,
    keyHash: hash,
    name: "Default",
  });

  return { merchantId, apiKey: plaintext };
}

/**
 * Get a merchant's decrypted private key for use with the Open Payments SDK.
 */
export async function getMerchantPrivateKey(
  merchantId: string
): Promise<{ privateKey: string; keyId: string; walletAddress: string } | null> {
  const { decryptPrivateKey } = await import("@/lib/crypto/keys");

  const result = await getDb()
    .select()
    .from(schema.merchants)
    .where(eq(schema.merchants.id, merchantId))
    .limit(1);

  if (result.length === 0) return null;

  const merchant = result[0];
  return {
    privateKey: decryptPrivateKey(merchant.privateKey),
    keyId: merchant.keyId,
    walletAddress: merchant.walletAddress,
  };
}
