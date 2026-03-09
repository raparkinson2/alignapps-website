/**
 * Cryptographic utilities for the web — mirrors mobile/src/lib/crypto.ts
 *
 * Uses the Web Crypto API (SHA-256) with the same fallback salt used by
 * expo-crypto when SecureStore is unavailable (web environment).
 * This lets the website verify passwords set by mobile users who were using
 * the fallback salt, as well as plain-text legacy passwords.
 */

const FALLBACK_SALT = 'fallback_salt_for_web_environment_only';

async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Hash a password using SHA-256 with the fallback salt.
 * Matches the mobile app's behavior when SecureStore is unavailable.
 */
export async function hashPassword(password: string): Promise<string> {
  return sha256Hex(`${FALLBACK_SALT}:${password}`);
}

/**
 * Check if a string appears to be already hashed (64-char hex string).
 */
export function isAlreadyHashed(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test(value);
}

/**
 * Verify a password against a stored hash (from the fallback-salt path).
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const hash = await hashPassword(password);
  return hash === storedHash;
}
