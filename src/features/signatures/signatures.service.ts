import { eq } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { db } from '../../db/index';
import { signatures, NewSignature } from './signatures.schema';
import { NotFoundError } from '../../utils/errors';
import {
  generateSecret,
  encryptSecret,
  decryptSecret,
  generateUserHash,
  generateDocumentHash,
  generateArticleSignature,
  verifyArticleSignature,
  generatePublicIdentifier,
} from '../../utils/crypto';

export interface SignDocumentResult {
  userHash: string;
  documentHash: string;
  signature: string;
  publicIdentifier: string;
}

async function getSignatureByUserId(userId: string) {
  const rows = await db
    .select()
    .from(signatures)
    .where(eq(signatures.userId, userId))
    .limit(1);

  if (rows.length === 0) {
    throw new NotFoundError('Signature not found');
  }

  return rows[0]!;
}

/**
 * Create a new signature for a user during registration.
 * Generates a per-user secret, creates the user hash, and encrypts the secret.
 * @param userId - The user's ID
 * @param email - The user's email
 * @param createdAt - The user's creation timestamp
 * @returns Object containing the userHash and signatureId
 */
export async function createSignature(
  userId: string,
  email: string,
  createdAt: Date
): Promise<{ userHash: string; signatureId: string }> {
  const secret = generateSecret();
  const userHash = generateUserHash(userId, email, createdAt, secret);
  const secretEncrypted = encryptSecret(secret);
  const now = new Date();

  const newSignature: NewSignature = {
    id: createId(),
    userId,
    userHash,
    secretEncrypted,
    createdAt: now,
  };

  await db.insert(signatures).values(newSignature);

  return { userHash, signatureId: newSignature.id };
}

/**
 * Sign a document with the user's authorship signature.
 * @param userId - The authenticated user's ID
 * @param content - The document content to sign
 * @returns Object containing documentHash, signature, and publicIdentifier
 */
export async function signDocument(
  userId: string,
  content: string
): Promise<SignDocumentResult> {
  const sig = await getSignatureByUserId(userId);
  const secret = decryptSecret(sig.secretEncrypted);
  const documentHash = generateDocumentHash(content);
  const signature = generateArticleSignature(sig.userHash, documentHash, secret);
  const publicIdentifier = generatePublicIdentifier(sig.userHash, documentHash);

  return { userHash: sig.userHash, documentHash, signature, publicIdentifier };
}

/**
 * Verify a document's authorship signature.
 * @param userId - The authenticated user's ID
 * @param content - The document content to verify
 * @param signature - The signature to verify against
 * @returns True if the signature is valid, false otherwise
 */
export async function verifyDocument(
  userId: string,
  content: string,
  signature: string
): Promise<boolean> {
  const sig = await getSignatureByUserId(userId);
  const secret = decryptSecret(sig.secretEncrypted);
  const documentHash = generateDocumentHash(content);
  return verifyArticleSignature(sig.userHash, documentHash, secret, signature);
}
