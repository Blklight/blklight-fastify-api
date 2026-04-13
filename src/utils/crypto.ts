import { pbkdf2Sync, randomBytes, timingSafeEqual, createCipheriv, createDecipheriv, createHmac, createHash, createSecretKey } from 'node:crypto';
import { env } from '../config/env';

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

/**
 * Generate a random secret for document signing.
 * @returns 64-character hex string (32 bytes)
 */
export function generateSecret(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Encrypt a secret using AES-256-GCM.
 * @param secret - The raw secret to encrypt (64-char hex)
 * @returns Encrypted string in format: iv:authTag:encryptedData (all hex)
 */
export function encryptSecret(secret: string): string {
  const key = createSecretKey(Buffer.from(env.SIGNATURE_ENCRYPTION_KEY!, 'hex'));
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt a secret encrypted with AES-256-GCM.
 * @param encryptedSecret - The encrypted string (format: iv:authTag:encryptedData)
 * @returns The decrypted secret (64-char hex)
 */
export function decryptSecret(encryptedSecret: string): string {
  const parts = encryptedSecret.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted secret format');
  }
  const ivHex = parts[0]!;
  const authTagHex = parts[1]!;
  const encryptedHex = parts[2]!;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const key = createSecretKey(Buffer.from(env.SIGNATURE_ENCRYPTION_KEY!, 'hex'));
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * Generate a user's public hash for authorship identification.
 * @param userId - The user's ID (CUID2)
 * @param email - The user's email address
 * @param createdAt - The user's creation timestamp
 * @param secret - The user's decrypted secret
 * @returns HMAC-SHA256 as hex string
 */
export function generateUserHash(userId: string, email: string, createdAt: Date, secret: string): string {
  const data = userId + email + createdAt.toISOString();
  return createHmac('sha256', secret).update(data).digest('hex');
}

/**
 * Generate a SHA-256 hash of document content.
 * @param content - The document content to hash
 * @returns SHA-256 hash as hex string
 */
export function generateDocumentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Generate an article signature using HMAC-SHA256.
 * @param userHash - The user's public hash
 * @param documentHash - The document content hash
 * @param secret - The user's decrypted secret
 * @returns HMAC-SHA256 signature as hex string
 */
export function generateArticleSignature(userHash: string, documentHash: string, secret: string): string {
  const data = userHash + documentHash;
  return createHmac('sha256', secret).update(data).digest('hex');
}

/**
 * Verify an article signature using timing-safe comparison.
 * @param userHash - The user's public hash
 * @param documentHash - The document content hash
 * @param secret - The user's decrypted secret
 * @param signature - The signature to verify
 * @returns True if signature is valid, false otherwise
 */
export function verifyArticleSignature(
  userHash: string,
  documentHash: string,
  secret: string,
  signature: string
): boolean {
  const computed = generateArticleSignature(userHash, documentHash, secret);
  if (computed.length !== signature.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
}

/**
 * Generate a public identifier for an article.
 * @param userHash - The user's public hash
 * @param documentHash - The document content hash
 * @returns Public identifier in format: PLT-{first8chars}.{first8chars}
 */
export function generatePublicIdentifier(userHash: string, documentHash: string): string {
  return `PLT-${userHash.slice(0, 8)}.${documentHash.slice(0, 8)}`;
}
