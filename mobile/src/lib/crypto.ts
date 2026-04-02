/**
 * Cryptographic utilities for securing sensitive user data
 *
 * Passwords are hashed with bcrypt (per-user salt, work factor 10).
 * Legacy SHA-256 hashes (64-char hex) are still verified for backwards
 * compatibility and are transparently migrated to bcrypt on next login.
 */
import * as Crypto from 'expo-crypto';
import bcrypt from 'bcryptjs';

// Legacy shared salt — only used to verify old SHA-256 hashes during migration
const LEGACY_SALT = 'align_sports_shared_salt_v1';
const BCRYPT_ROUNDS = 10;

// ─── Internal helpers ────────────────────────────────────────────────────────

async function legacyHash(password: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${LEGACY_SALT}:${password}`
  );
}

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
 * Returns true if the value looks like any known hash format
 * (bcrypt or legacy 64-char hex SHA-256).
 */
export function isAlreadyHashed(value: string): boolean {
  return isBcryptHash(value) || /^[a-f0-9]{64}$/i.test(value);
}

/**
 * Verify a password against a stored hash.
 * Handles both bcrypt hashes and legacy SHA-256 hashes.
 *
 * @returns `{ valid: true }` on match, `{ valid: false }` on mismatch,
 *          plus `legacy: true` when the stored hash is the old SHA-256 format
 *          so the caller can trigger an upgrade.
 */
export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<{ valid: boolean; legacy: boolean }> {
  if (isBcryptHash(storedHash)) {
    const valid = await bcrypt.compare(password, storedHash);
    return { valid, legacy: false };
  }

  // Legacy SHA-256 path
  const hash = await legacyHash(password);
  return { valid: hash === storedHash, legacy: true };
}

/**
 * Hash a security answer (case-insensitive, trimmed).
 * Security answers use the same bcrypt path as passwords.
 */
export async function hashSecurityAnswer(answer: string): Promise<string> {
  return hashPassword(answer.toLowerCase().trim());
}

/**
 * Verify a security answer against a stored hash.
 * Handles both bcrypt and legacy SHA-256 formats.
 */
export async function verifySecurityAnswer(
  answer: string,
  storedHash: string
): Promise<boolean> {
  const normalized = answer.toLowerCase().trim();
  if (isBcryptHash(storedHash)) {
    return bcrypt.compare(normalized, storedHash);
  }
  // Legacy: SHA-256 was applied to the lowercased answer
  const hash = await legacyHash(normalized);
  return hash === storedHash;
}
