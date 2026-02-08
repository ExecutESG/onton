// lib/cryptoHelpers.ts
import crypto from "crypto";

/* -------------------------------------------------------------------------- */
/*                1. Load a 32-byte key from an environment var               */
/* -------------------------------------------------------------------------- */
/**
 * Create one once:
 *   $ openssl rand -base64 32
 * Add it to your secrets manager or .env for local development:
 *   EVENT_WALLET_ENC_KEY=Ci5M6/B4Wke4qX6tXViVeW0xM0iH0yh/qvD3Y1xu2v8=
 */
const KEY_B64 = process.env.EVENT_WALLET_ENC_KEY ?? "";
const KEY = Buffer.from(KEY_B64, "base64");
if (KEY.length !== 32) {
  throw new Error("❌ EVENT_WALLET_ENC_KEY must be a 32-byte base64 string (AES-256 key).");
}

/* -------------------------------------------------------------------------- */
/*                2. Encrypt / decrypt with AES-256-GCM (12-B IV)             */
/* -------------------------------------------------------------------------- */
export function encrypt(plainText: string): string {
  const iv = crypto.randomBytes(12); // 96-bit nonce recommended for GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);

  const ciphertext = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag(); // 16 bytes

  // Store as: iv || tag || ciphertext → base64
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

export function decrypt(encoded: string): string {
  const buf = Buffer.from(encoded, "base64");

  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28); // 16 B
  const ciphertext = buf.subarray(28);

  const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
  decipher.setAuthTag(tag);

  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain.toString("utf8");
}
