import { eq, and, count } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { db } from '../../db/index';
import { documentLikes } from './likes.schema';
import { documents } from '../documents/documents.schema';
import { NotFoundError } from '../../utils/errors';

export interface LikesCount {
  likesCount: number;
  likedByMe: boolean | null;
}

export interface ToggleLikeResult {
  liked: boolean;
  likesCount: number;
}

/**
 * Get the likes count for a document and optionally whether the user has liked it.
 * @param documentId - The document ID
 * @param userId - Optional user ID to check if they liked the document
 * @returns Object with likes count and liked_by_me status
 */
export async function getLikesCount(documentId: string, userId?: string): Promise<LikesCount> {
  const [countResult] = await db
    .select({ count: count() })
    .from(documentLikes)
    .where(eq(documentLikes.documentId, documentId));

  const likesCount = Number(countResult?.count ?? 0);

  if (!userId) {
    return { likesCount, likedByMe: null };
  }

  const [existingLike] = await db
    .select({ id: documentLikes.id })
    .from(documentLikes)
    .where(
      and(
        eq(documentLikes.userId, userId),
        eq(documentLikes.documentId, documentId)
      )
    )
    .limit(1);

  return { likesCount, likedByMe: existingLike !== undefined };
}

/**
 * Toggle like status for a document.
 * @param userId - The user's ID
 * @param documentId - The document ID
 * @returns Object with liked status and updated likes count
 * @throws NotFoundError if document not found or not published
 */
export async function toggleLike(userId: string, documentId: string): Promise<ToggleLikeResult> {
  const [doc] = await db
    .select({ id: documents.id })
    .from(documents)
    .where(
      and(
        eq(documents.id, documentId),
        eq(documents.status, 'published')
      )
    )
    .limit(1);

  if (!doc) {
    throw new NotFoundError('Document not found');
  }

  const [existingLike] = await db
    .select({ id: documentLikes.id })
    .from(documentLikes)
    .where(
      and(
        eq(documentLikes.userId, userId),
        eq(documentLikes.documentId, documentId)
      )
    )
    .limit(1);

  let liked = false;

  if (existingLike) {
    await db
      .delete(documentLikes)
      .where(eq(documentLikes.id, existingLike.id));
  } else {
    await db.insert(documentLikes).values({
      id: createId(),
      userId,
      documentId,
      createdAt: new Date(),
    });
    liked = true;
  }

  const [countResult] = await db
    .select({ count: count() })
    .from(documentLikes)
    .where(eq(documentLikes.documentId, documentId));

  return { liked, likesCount: Number(countResult?.count ?? 0) };
}
