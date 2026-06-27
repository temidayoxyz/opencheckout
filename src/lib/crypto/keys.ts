import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || !/^[a-f0-9]{64}$/i.test(key)) {
    throw new Error(
      "ENCRYPTION_KEY must be set to a 64-character hex string (32 bytes)"
    );
  }
  return Buffer.from(key, "hex");
}

/**
 * Encrypt a private key string using AES-256-GCM.
 * Returns base64-encoded: salt + iv + authTag + ciphertext
 */
export function encryptPrivateKey(plaintext: string): string {
  const masterKey = getEncryptionKey();
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);

  const key = scryptSync(masterKey, salt, KEY_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Concatenate: salt | iv | authTag | ciphertext
  const result = Buffer.concat([salt, iv, authTag, encrypted]);
  return result.toString("base64");
}

/**
 * Decrypt a private key string that was encrypted with encryptPrivateKey.
 */
export function decryptPrivateKey(encoded: string): string {
  const masterKey = getEncryptionKey();
  const buffer = Buffer.from(encoded, "base64");

  const salt = buffer.subarray(0, SALT_LENGTH);
  const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = buffer.subarray(
    SALT_LENGTH + IV_LENGTH,
    SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
  );
  const ciphertext = buffer.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

  const key = scryptSync(masterKey, salt, KEY_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

const STORED_SECRET_PREFIX = "enc:v1:";

/** Encrypt an arbitrary secret while preserving backwards-compatible reads. */
export function encryptStoredSecret(plaintext: string): string {
  return `${STORED_SECRET_PREFIX}${encryptPrivateKey(plaintext)}`;
}

/**
 * Decrypt secrets written by encryptStoredSecret. Legacy plaintext values are
 * returned unchanged so existing installations can migrate on their next write.
 */
export function decryptStoredSecret(value: string): string {
  if (!value.startsWith(STORED_SECRET_PREFIX)) return value;
  return decryptPrivateKey(value.slice(STORED_SECRET_PREFIX.length));
}
