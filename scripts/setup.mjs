/**
 * OpenCheckout Setup Wizard
 *
 * Creates the initial merchant configuration:
 * - Generates an encryption key (if not set)
 * - Creates the merchant record with wallet address + encrypted private key
 * - Generates an API key
 */

import { createInterface } from "readline";
import { readFileSync } from "fs";
import { ensureSchema } from "./ensure-schema.mjs";

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => rl.question(prompt, resolve));
}

async function main() {
  console.log("\n  OpenCheckout Setup\n");
  console.log("  This wizard will configure your merchant account.\n");

  const name = String(await question("  Merchant name: ")).trim();
  const walletAddress = String(
    await question("  Wallet address URL: ")
  ).trim();
  const keyId = String(await question("  Key ID: ")).trim();
  const privateKeyPath = String(
    await question("  Path to private key file: ")
  ).trim();

  if (!name || !keyId || !privateKeyPath) {
    throw new Error("Merchant name, key ID, and private key path are required");
  }
  const parsedWallet = new URL(walletAddress);
  if (parsedWallet.protocol !== "https:") {
    throw new Error("Wallet address must be a public HTTPS URL");
  }

  let privateKey;
  try {
    privateKey = readFileSync(privateKeyPath, "utf8").trim();
  } catch {
    console.error(
      `\n  Error: Could not read private key file at "${privateKeyPath}"\n`
    );
    process.exit(1);
  }

  // Generate encryption key if not set
  const crypto = await import("crypto");
  let encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    encryptionKey = crypto.randomBytes(32).toString("hex");
    console.log(`\n  Generated ENCRYPTION_KEY: ${encryptionKey}`);
    console.log("  Add this to your .env file.\n");
  }
  if (!/^[a-f0-9]{64}$/i.test(encryptionKey)) {
    throw new Error("ENCRYPTION_KEY must be a 64-character hexadecimal value");
  }

  // Load the database and onboarding modules dynamically
  process.env.ENCRYPTION_KEY = encryptionKey;

  // We need to run this in the Next.js context, so we use a simple
  // direct SQLite approach for the setup script
  const Database = (await import("better-sqlite3")).default;
  const crypto2 = await import("crypto");

  const { createHash, createCipheriv, randomBytes, scryptSync } = crypto2;

  const DB_PATH = process.env.DATABASE_URL ?? "data/opencheckout.db";
  ensureSchema(DB_PATH);
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // Encrypt the private key
  const ALGORITHM = "aes-256-gcm";
  const KEY_LENGTH = 32;
  const IV_LENGTH = 16;
  const SALT_LENGTH = 32;

  const masterKey = Buffer.from(encryptionKey, "hex");
  function encryptValue(value) {
    const salt = randomBytes(SALT_LENGTH);
    const iv = randomBytes(IV_LENGTH);
    const key = scryptSync(masterKey, salt, KEY_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([
      cipher.update(value, "utf8"),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([salt, iv, authTag, encrypted]).toString("base64");
  }

  const encryptedKey = encryptValue(privateKey);

  // Generate IDs using crypto.randomBytes for security
  function secureNanoid(len) {
    const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    return Array.from(
      { length: len },
      () => alphabet[crypto.randomInt(0, alphabet.length)]
    ).join("");
  }

  const merchantId = `mer_${secureNanoid(12)}`;
  const webhookSecret = crypto.randomBytes(32).toString("hex");
  const encryptedWebhookSecret = `enc:v1:${encryptValue(webhookSecret)}`;

  // Insert merchant
  db.prepare(
    `INSERT INTO merchants (id, name, wallet_address, private_key, key_id, webhook_secret)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    merchantId,
    name,
    walletAddress,
    encryptedKey,
    keyId,
    encryptedWebhookSecret
  );

  // Generate API key with secure randomness
  const apiKeyRandom = crypto.randomBytes(32).toString("base64url");
  const apiKey = `sk_${apiKeyRandom}`;
  const keyHash = createHash("sha256").update(apiKey).digest("hex");
  const apiKeyId = `ak_${secureNanoid(10)}`;

  db.prepare(
    `INSERT INTO api_keys (id, merchant_id, key_hash, name)
     VALUES (?, ?, ?, ?)`
  ).run(apiKeyId, merchantId, keyHash, "Default");

  console.log("\n  Merchant created successfully!\n");
  console.log(`  Merchant ID: ${merchantId}`);
  console.log(`  API Key:     ${apiKey}`);
  console.log("\n  Store this API key securely. It will not be shown again.\n");
  console.log(
    `  Your merchant dashboard is available at: ${process.env.BASE_URL ?? "http://localhost:3080"}/dashboard\n`
  );

  db.close();
  rl.close();
}

main().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
