import { randomBytes, createHash } from "crypto";

const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const KEY_LENGTH = 32; // random portion length
const PREFIX_VISIBLE_CHARS = 10; // "sk_flow_" + 2 chars

export function generateApiKey(): {
  fullKey: string;
  prefix: string;
  keyHash: string;
} {
  const bytes = randomBytes(KEY_LENGTH);
  let suffix = "";
  for (let i = 0; i < KEY_LENGTH; i++) {
    suffix += ALPHABET[bytes[i] % ALPHABET.length];
  }
  const fullKey = `sk_flow_${suffix}`;
  return {
    fullKey,
    prefix: fullKey.slice(0, PREFIX_VISIBLE_CHARS),
    keyHash: hashApiKey(fullKey),
  };
}

export function hashApiKey(fullKey: string): string {
  return createHash("sha256").update(fullKey).digest("hex");
}

export function maskApiKey(prefix: string): string {
  return `${prefix}${"•".repeat(16)}`;
}
