import { eq, and, count, desc } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { db } from '../../db/index';
import { tags, documentTags, Tag } from './tags.schema';
import { ValidationError } from '../../utils/errors';

function tagSlug(name: string): string {
  return name
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);
}

/**
 * Normalize a tag name (trim + lowercase).
 * @param name - Raw tag name
 * @returns Normalized tag name
 */
export function normalizeTag(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Upsert tags by name. Returns existing or newly created Tag records.
 * @param tagNames - Array of raw tag names (will be normalized)
 * @returns Array of Tag records
 */
export async function upsertTags(tagNames: string[]): Promise<Tag[]> {
  if (tagNames.length === 0) {
    return [];
  }

  const normalized = tagNames.map((n) => normalizeTag(n));
  const uniqueNames = [...new Set(normalized)];

  const result: Tag[] = [];

  for (const name of uniqueNames) {
    const [existing] = await db
      .select()
      .from(tags)
      .where(eq(tags.name, name))
      .limit(1);

    if (existing) {
      result.push(existing);
    } else {
      const [created] = await db
        .insert(tags)
        .values({
          id: createId(),
          name,
          slug: tagSlug(name),
          createdAt: new Date(),
        })
        .returning();

      result.push(created!);
    }
  }

  return result;
}

/**
 * Set tags on a document. Replaces all existing tags (delete then insert).
 * @param documentId - Document ID
 * @param tagNames - Array of raw tag names (max 5, will be normalized)
 */
export async function setDocumentTags(documentId: string, tagNames: string[]): Promise<Tag[]> {
  if (tagNames.length > 5) {
    throw new ValidationError('Maximum 5 tags allowed per document');
  }

  const tagRecords = await upsertTags(tagNames);

  await db.transaction(async (tx) => {
    await tx
      .delete(documentTags)
      .where(eq(documentTags.documentId, documentId));

    for (const tag of tagRecords) {
      await tx.insert(documentTags).values({
        id: createId(),
        documentId,
        tagId: tag.id,
        createdAt: new Date(),
      });
    }
  });

  return tagRecords;
}

/**
 * Get all tags for a document.
 * @param documentId - Document ID
 * @returns Array of Tag records
 */
export async function getDocumentTags(documentId: string): Promise<Tag[]> {
  const results = await db
    .select({
      id: tags.id,
      name: tags.name,
      slug: tags.slug,
      createdAt: tags.createdAt,
    })
    .from(documentTags)
    .innerJoin(tags, eq(documentTags.tagId, tags.id))
    .where(eq(documentTags.documentId, documentId));

  return results;
}

/**
 * Get popular tags sorted by usage count.
 * @param limit - Max number of tags to return (default 20, max 50)
 * @returns Array of tags with document count
 */
export async function getPopularTags(limit: number = 20): Promise<(Tag & { documentCount: number })[]> {
  const safeLimit = Math.min(limit, 50);

  const results = await db
    .select({
      id: tags.id,
      name: tags.name,
      slug: tags.slug,
      createdAt: tags.createdAt,
      documentCount: count(documentTags.tagId),
    })
    .from(tags)
    .leftJoin(documentTags, eq(tags.id, documentTags.tagId))
    .groupBy(tags.id)
    .orderBy(desc(count(documentTags.tagId)), desc(tags.createdAt))
    .limit(safeLimit);

  return results.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    createdAt: r.createdAt,
    documentCount: Number(r.documentCount ?? 0),
  }));
}
