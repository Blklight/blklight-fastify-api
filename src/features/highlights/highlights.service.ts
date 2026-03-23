import { eq, and, isNull, desc, asc, sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { db } from '../../db/index';
import { highlights, highlightPalette, Highlight } from './highlights.schema';
import { documents } from '../documents/documents.schema';
import { profiles } from '../profiles/profiles.schema';
import { users } from '../auth/auth.schema';
import { NotFoundError, ValidationError } from '../../utils/errors';
import { encodeCursor, decodeCursor } from '../../utils/cursor';
import DEFAULT_PALETTE from '../../config/highlight-palette';
import type { CreateHighlightInput, UpdateHighlightInput } from './highlights.zod';

export interface Selection {
  text: string;
  color: string;
  position: {
    nodeIndex: number;
    offsetStart: number;
    offsetEnd: number;
  };
}

export interface PaletteResult {
  colors: string[];
  isCustom: boolean;
}

async function getActivePalette(userId: string): Promise<string[]> {
  const [row] = await db
    .select()
    .from(highlightPalette)
    .where(eq(highlightPalette.userId, userId))
    .limit(1);

  if (!row) {
    return DEFAULT_PALETTE.map((c) => c.hex);
  }

  return row.colors as string[];
}

/**
 * Get the user's highlight palette.
 * @param userId - The user's ID
 * @returns Palette colors and whether it's customized
 */
export async function getPalette(userId: string): Promise<PaletteResult> {
  const [row] = await db
    .select()
    .from(highlightPalette)
    .where(eq(highlightPalette.userId, userId))
    .limit(1);

  if (!row) {
    return {
      colors: DEFAULT_PALETTE.map((c) => c.hex),
      isCustom: false,
    };
  }

  return {
    colors: row.colors as string[],
    isCustom: true,
  };
}

/**
 * Update the user's highlight palette.
 * @param userId - The user's ID
 * @param colors - Array of 5 hex color strings
 */
export async function updatePalette(userId: string, colors: string[]): Promise<void> {
  const [existing] = await db
    .select()
    .from(highlightPalette)
    .where(eq(highlightPalette.userId, userId))
    .limit(1);

  const now = new Date();

  if (existing) {
    await db
      .update(highlightPalette)
      .set({ colors, updatedAt: now })
      .where(eq(highlightPalette.id, existing.id));
  } else {
    await db.insert(highlightPalette).values({
      id: createId(),
      userId,
      colors,
      createdAt: now,
      updatedAt: now,
    });
  }
}

/**
 * Create a new highlight.
 * @param userId - The user's ID
 * @param data - Highlight data
 * @returns Created highlight
 */
export async function createHighlight(userId: string, data: CreateHighlightInput): Promise<Highlight> {
  const [doc] = await db
    .select({ id: documents.id })
    .from(documents)
    .where(
      and(
        eq(documents.id, data.documentId),
        eq(documents.status, 'published'),
        isNull(documents.deletedAt)
      )
    )
    .limit(1);

  if (!doc) {
    throw new NotFoundError('Document not found or not published');
  }

  const palette = await getActivePalette(userId);
  if (!palette.includes(data.selection.color)) {
    throw new ValidationError('Color must be from your highlight palette');
  }

  const now = new Date();
  const [highlight] = await db
    .insert(highlights)
    .values({
      id: createId(),
      userId,
      documentId: data.documentId,
      selection: data.selection,
      annotation: data.annotation ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return highlight!;
}

/**
 * Update a highlight.
 * @param userId - The user's ID
 * @param id - Highlight ID
 * @param data - Fields to update
 * @returns Updated highlight
 */
export async function updateHighlight(
  userId: string,
  id: string,
  data: UpdateHighlightInput
): Promise<Highlight> {
  const [existing] = await db
    .select()
    .from(highlights)
    .where(and(eq(highlights.id, id), eq(highlights.userId, userId)))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Highlight not found');
  }

  if (data.selection?.color) {
    const palette = await getActivePalette(userId);
    if (!palette.includes(data.selection.color)) {
      throw new ValidationError('Color must be from your highlight palette');
    }
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (data.selection !== undefined) {
    updates.selection = data.selection;
  }
  if (data.annotation !== undefined) {
    updates.annotation = data.annotation;
  }

  await db
    .update(highlights)
    .set(updates)
    .where(eq(highlights.id, id));

  const [updated] = await db
    .select()
    .from(highlights)
    .where(eq(highlights.id, id))
    .limit(1);

  return updated!;
}

/**
 * Delete a highlight.
 * @param userId - The user's ID
 * @param id - Highlight ID
 */
export async function deleteHighlight(userId: string, id: string): Promise<void> {
  const [existing] = await db
    .select()
    .from(highlights)
    .where(and(eq(highlights.id, id), eq(highlights.userId, userId)))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Highlight not found');
  }

  await db
    .delete(highlights)
    .where(eq(highlights.id, id));
}

export interface HighlightParams {
  cursor?: string;
  limit?: number;
}

export interface DocumentRef {
  id: string;
  title: string;
  slug: string;
  authorUsername: string;
}

export interface HighlightGrouped {
  document: DocumentRef;
  highlights: Highlight[];
}

export interface HighlightGroupedResult {
  items: HighlightGrouped[];
  nextCursor: string | null;
  total: number;
}

/**
 * Get all highlights for a user, grouped by document.
 * @param userId - The user's ID
 * @param params - Pagination params
 * @returns Grouped highlights with pagination
 */
export async function getMyHighlights(
  userId: string,
  params: HighlightParams
): Promise<HighlightGroupedResult> {
  const limit = Math.min(params.limit ?? 20, 50);

  let baseQuery = db
    .select({
      id: highlights.id,
      userId: highlights.userId,
      documentId: highlights.documentId,
      selection: highlights.selection,
      annotation: highlights.annotation,
      createdAt: highlights.createdAt,
      updatedAt: highlights.updatedAt,
      docTitle: documents.title,
      docSlug: documents.slug,
      authorUsername: profiles.username,
    })
    .from(highlights)
    .innerJoin(documents, eq(highlights.documentId, documents.id))
    .innerJoin(profiles, eq(documents.authorId, profiles.id))
    .where(eq(highlights.userId, userId));

  let results: any[];

  if (params.cursor) {
    const { timestamp: publishedAt, id } = decodeCursor(params.cursor);
    results = await db
      .select({
        id: highlights.id,
        userId: highlights.userId,
        documentId: highlights.documentId,
        selection: highlights.selection,
        annotation: highlights.annotation,
        createdAt: highlights.createdAt,
        updatedAt: highlights.updatedAt,
        docTitle: documents.title,
        docSlug: documents.slug,
        authorUsername: profiles.username,
      })
      .from(highlights)
      .innerJoin(documents, eq(highlights.documentId, documents.id))
      .innerJoin(profiles, eq(documents.authorId, profiles.id))
      .where(
        and(
          eq(highlights.userId, userId),
          sql`${highlights.createdAt} < ${publishedAt}`
        )
      )
      .orderBy(desc(highlights.createdAt), desc(highlights.id))
      .limit(limit + 1);
  } else {
    results = await baseQuery
      .orderBy(desc(highlights.createdAt), desc(highlights.id))
      .limit(limit + 1);
  }

  const hasMore = results.length > limit;
  if (hasMore) {
    results.pop();
  }

  const groupedMap = new Map<string, HighlightGrouped>();
  for (const r of results) {
    if (!groupedMap.has(r.documentId)) {
      groupedMap.set(r.documentId, {
        document: {
          id: r.documentId,
          title: r.docTitle,
          slug: r.docSlug,
          authorUsername: r.authorUsername,
        },
        highlights: [],
      });
    }
    groupedMap.get(r.documentId)!.highlights.push({
      id: r.id,
      userId: r.userId,
      documentId: r.documentId,
      selection: r.selection as Selection,
      annotation: r.annotation as Record<string, unknown> | null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    });
  }

  const items = Array.from(groupedMap.values());
  const lastResult = results[results.length - 1];
  const nextCursor = hasMore && lastResult
    ? encodeCursor(lastResult.createdAt, lastResult.id)
    : null;

  const countResult = await db
    .select({ count: sql<number>`COUNT(DISTINCT ${highlights.documentId})` })
    .from(highlights)
    .where(eq(highlights.userId, userId));

  const total = Number(countResult[0]?.count ?? 0);

  return { items, nextCursor, total };
}

/**
 * Get all highlights for a user on a specific document, in reading order.
 * @param userId - The user's ID
 * @param documentId - Document ID
 * @returns Highlights sorted by position
 */
export async function getDocumentHighlights(
  userId: string,
  documentId: string
): Promise<Highlight[]> {
  const results = await db
    .select()
    .from(highlights)
    .where(
      and(
        eq(highlights.userId, userId),
        eq(highlights.documentId, documentId)
      )
    )
    .orderBy(
      asc(sql`(${highlights.selection}->'position'->>'nodeIndex')::int`),
      asc(sql`(${highlights.selection}->'position'->>'offsetStart')::int`)
    );

  return results.map((r) => ({
    ...r,
    selection: r.selection as Selection,
    annotation: r.annotation as Record<string, unknown> | null,
  }));
}
