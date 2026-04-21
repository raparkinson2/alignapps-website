/**
 * Cryptographic utilities for the web — mirrors mobile/src/lib/crypto.ts
 *
 * Passwords are hashed with bcrypt (per-user salt, work factor 10).
 */
import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 10;

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Hash a password with bcrypt (unique per-user salt, slow by design).
 * Always produces a `$2b$` prefixed string.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
  return bcrypt.hash(password, salt);
}

/**
 * Returns true if the value is a bcrypt hash (`$2b$` / `$2a$` prefix).
 */
export function isBcryptHash(value: string): boolean {
  return value.startsWith('$2b$') || value.startsWith('$2a$');
}

/**
 * Returns true if the value looks like a bcrypt hash.
 */
export function isAlreadyHashed(value: string): boolean {
  return isBcryptHash(value);
}

/**
 * Verify a password against a stored bcrypt hash.
 */
export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  if (!isBcryptHash(storedHash)) return false;
  return bcrypt.compare(password, storedHash);
}
