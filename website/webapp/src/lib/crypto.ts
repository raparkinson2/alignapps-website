/**
 * Cryptographic utilities for the web — mirrors mobile/src/lib/crypto.ts
 *
 * Passwords are hashed with bcrypt (per-user salt, work factor 10).
 * Legacy SHA-256 hashes (64-char hex) are still verified for backwards
 * compatibility and are transparently migrated to bcrypt on next login.
 */
import bcrypt from 'bcryptjs';

const LEGACY_SALT = 'align_sports_shared_salt_v1';
const BCRYPT_ROUNDS = 10;

// ─── Internal helpers ────────────────────────────────────────────────────────

async function legacyHash(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${LEGACY_SALT}:${password}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
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
 * Returns `legacy: true` when the stored hash is old SHA-256 format
 * so the caller can trigger an upgrade.
 */
export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<{ valid: boolean; legacy: boolean }> {
  if (isBcryptHash(storedHash)) {
    const valid = await bcrypt.compare(password, storedHash);
    return { valid, legacy: false };
  }
  const hash = await legacyHash(password);
  return { valid: hash === storedHash, legacy: true };
}
