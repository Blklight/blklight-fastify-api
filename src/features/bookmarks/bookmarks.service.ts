import { eq, and, isNull, desc, count, lt } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { db } from '../../db/index';
import { documentBookmarks } from './bookmarks.schema';
import { documents, documentTypes } from '../documents/documents.schema';
import { profiles } from '../profiles/profiles.schema';
import { users } from '../auth/auth.schema';
import { NotFoundError } from '../../utils/errors';
import { encodeCursor, decodeCursor } from '../../utils/cursor';
import { getDocumentTags } from '../tags/tags.service';
import { getDocumentCategory } from '../categories/categories.service';
import type { DocumentCard, FeedResult } from '../documents/documents.service';
import type { Authorship } from '../documents/documents.service';

export interface BookmarkParams {
  cursor?: string;
  limit?: number;
}

export interface BookmarkResult {
  items: DocumentCard[];
  nextCursor: string | null;
  total: number;
}

/**
 * Get the user's bookmarks with cursor-based pagination.
 * @param userId - The user's ID
 * @param params - Pagination parameters
 * @returns Paginated list of bookmarked documents
 */
export async function getMyBookmarks(userId: string, params: BookmarkParams): Promise<BookmarkResult> {
  const limit = Math.min(params.limit ?? 20, 50);
  const conditions: ReturnType<typeof eq>[] = [];

  conditions.push(eq(documentBookmarks.userId, userId));

  if (params.cursor) {
    const { publishedAt, id } = decodeCursor(params.cursor);
    conditions.push(lt(documents.publishedAt, publishedAt));
  }

  const results = await db
    .select({
      id: documents.id,
      title: documents.title,
      abstract: documents.abstract,
      coverImageUrl: documents.coverImageUrl,
      slug: documents.slug,
      publishedAt: documents.publishedAt,
      typeName: documentTypes.name,
      username: profiles.username,
      displayName: profiles.displayName,
      avatarUrl: profiles.avatarUrl,
      authorship: documents.authorship,
    })
    .from(documentBookmarks)
    .innerJoin(documents, eq(documentBookmarks.documentId, documents.id))
    .innerJoin(documentTypes, eq(documents.typeId, documentTypes.id))
    .innerJoin(profiles, eq(documents.authorId, profiles.id))
    .innerJoin(users, eq(profiles.userId, users.id))
    .where(
      and(
        ...conditions,
        eq(documents.status, 'published'),
        isNull(documents.deletedAt),
        isNull(profiles.deletedAt),
        isNull(users.deletedAt)
      )
    )
    .orderBy(desc(documents.publishedAt), desc(documents.id))
    .limit(limit + 1);

  const hasMore = results.length > limit;
  if (hasMore) {
    results.pop();
  }

  const items: DocumentCard[] = await Promise.all(
    results.map(async (r) => {
      const authorship = r.authorship as Authorship | null;
      const docTags = await getDocumentTags(r.id);
      const docCategory = await getDocumentCategory(r.id);
      return {
        id: r.id,
        title: r.title,
        abstract: r.abstract,
        coverImageUrl: r.coverImageUrl,
        slug: r.slug,
        publishedAt: r.publishedAt as Date,
        typeName: r.typeName,
        author: {
          username: r.username,
          displayName: r.displayName,
          avatarUrl: r.avatarUrl,
        },
        authorship: {
          publicIdentifier: authorship?.publicIdentifier ?? '',
        },
        likesCount: 0,
        category: docCategory
          ? { id: docCategory.id, name: docCategory.name, slug: docCategory.slug }
          : null,
        tags: docTags.map((t) => ({ id: t.id, name: t.name, slug: t.slug })),
      };
    })
  );

  const lastResult = results[results.length - 1];
  const nextCursor = hasMore && lastResult
    ? encodeCursor(lastResult.publishedAt as Date, lastResult.id)
    : null;

  const [countResult] = await db
    .select({ count: count() })
    .from(documentBookmarks)
    .innerJoin(documents, eq(documentBookmarks.documentId, documents.id))
    .innerJoin(documentTypes, eq(documents.typeId, documentTypes.id))
    .innerJoin(profiles, eq(documents.authorId, profiles.id))
    .where(
      and(
        eq(documentBookmarks.userId, userId),
        eq(documents.status, 'published'),
        isNull(documents.deletedAt),
        isNull(profiles.deletedAt),
        isNull(users.deletedAt)
      )
    );

  const total = Number(countResult?.count ?? 0);

  return { items, nextCursor, total };
}

/**
 * Toggle bookmark status for a document.
 * @param userId - The user's ID
 * @param documentId - The document ID
 * @returns Object with bookmarked status
 * @throws NotFoundError if document not found or not published
 */
export async function toggleBookmark(userId: string, documentId: string): Promise<{ bookmarked: boolean }> {
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

  const [existingBookmark] = await db
    .select({ id: documentBookmarks.id })
    .from(documentBookmarks)
    .where(
      and(
        eq(documentBookmarks.userId, userId),
        eq(documentBookmarks.documentId, documentId)
      )
    )
    .limit(1);

  let bookmarked = false;

  if (existingBookmark) {
    await db
      .delete(documentBookmarks)
      .where(eq(documentBookmarks.id, existingBookmark.id));
  } else {
    await db.insert(documentBookmarks).values({
      id: createId(),
      userId,
      documentId,
      createdAt: new Date(),
    });
    bookmarked = true;
  }

  return { bookmarked };
}

/**
 * Check if a user has bookmarked a document.
 * @param userId - The user's ID
 * @param documentId - The document ID
 * @returns True if bookmarked, false otherwise
 */
export async function isBookmarked(userId: string, documentId: string): Promise<boolean> {
  const [existingBookmark] = await db
    .select({ id: documentBookmarks.id })
    .from(documentBookmarks)
    .where(
      and(
        eq(documentBookmarks.userId, userId),
        eq(documentBookmarks.documentId, documentId)
      )
    )
    .limit(1);

  return existingBookmark !== undefined;
}
