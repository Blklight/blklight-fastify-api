import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';

const ITERATIONS = 120_000;
const KEY_LENGTH = 128;
const DIGEST = 'sha512';

/**
 * Hash a password using PBKDF2 with SHA-512.
 * 120,000 iterations per OWASP 2024 recommendation for SHA-512.
 * @param password - Plain text password to hash
 * @returns Object containing the base64 hash and base64 salt
 */
export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = randomBytes(64).toString('base64');
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString('base64');
  return { hash, salt };
}

/**
 * Verify a password against a stored hash and salt.
 * @param password - Plain text password to verify
 * @param hash - Stored password hash (base64)
 * @param salt - Stored salt (base64)
 * @returns True if password matches, false otherwise
 */
export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const computedHash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString('base64');
  if (hash.length !== computedHash.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(hash), Buffer.from(computedHash));
}
