import { eq, and, sql, count, desc } from 'drizzle-orm';
import { db } from '../../db/index';
import { journals, journalHighlights, Journal, JournalHighlight } from './journals.schema';
import { highlights, Highlight } from '../highlights/highlights.schema';
import { documents } from '../documents/documents.schema';
import { profiles } from '../profiles/profiles.schema';
import { resolveWorkspaceId } from '../workspace/workspace.service';
import { ValidationError, NotFoundError, ConflictError } from '../../utils/errors';
import { NOTE_COLORS } from '../../config/note-colors';
import type { CreateJournalInput, UpdateJournalInput, AddHighlightInput, ReorderHighlightsInput } from './journals.zod';
import { createId } from '@paralleldrive/cuid2';

export interface JournalWithCount extends Journal {
  highlightCount: number;
}

export interface JournalHighlightWithDetails extends JournalHighlight {
  highlight: Highlight & {
    document: {
      id: string;
      title: string;
      slug: string;
      authorUsername: string;
    };
  };
}

export interface JournalFull extends Journal {
  highlights: JournalHighlightWithDetails[];
}

/**
 * Create a new journal for the user.
 * @param userId - The user's ID
 * @param data - Journal creation data
 * @returns The created journal
 * @throws ValidationError if journal limit (2) reached
 */
export async function createJournal(
  userId: string,
  data: CreateJournalInput
): Promise<Journal> {
  const workspaceId = await resolveWorkspaceId(userId);

  const [existingCount] = await db
    .select({ count: count() })
    .from(journals)
    .where(sql`workspace_id = ${workspaceId} AND deleted_at IS NULL`)
    .limit(1);

  if (Number(existingCount?.count ?? 0) >= 2) {
    throw new ValidationError('Journal limit reached. Maximum 2 journals per account.');
  }

  if (data.color && !NOTE_COLORS.includes(data.color)) {
    throw new ValidationError(`Invalid color: ${data.color}`);
  }

  const [created] = await db
    .insert(journals)
    .values({
      id: createId(),
      workspaceId,
      title: data.title,
      description: data.description ?? null,
      color: data.color ?? 'indigo',
    })
    .returning();

  return created!;
}

/**
 * Update an existing journal.
 * @param userId - The user's ID
 * @param id - The journal ID
 * @param data - Update data
 * @returns The updated journal
 * @throws NotFoundError if journal not found or doesn't belong to user
 */
export async function updateJournal(
  userId: string,
  id: string,
  data: UpdateJournalInput
): Promise<Journal> {
  const workspaceId = await resolveWorkspaceId(userId);

  const [existing] = await db
    .select()
    .from(journals)
    .where(and(eq(journals.id, id), eq(journals.workspaceId, workspaceId)))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Journal not found');
  }

  if (data.color && !NOTE_COLORS.includes(data.color)) {
    throw new ValidationError(`Invalid color: ${data.color}`);
  }

  const [updated] = await db
    .update(journals)
    .set({
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.color !== undefined && { color: data.color }),
      updatedAt: new Date(),
    })
    .where(eq(journals.id, id))
    .returning();

  return updated!;
}

/**
 * Soft delete a journal.
 * @param userId - The user's ID
 * @param id - The journal ID
 * @throws NotFoundError if journal not found or doesn't belong to user
 */
export async function deleteJournal(userId: string, id: string): Promise<void> {
  const workspaceId = await resolveWorkspaceId(userId);

  const [existing] = await db
    .select()
    .from(journals)
    .where(and(eq(journals.id, id), eq(journals.workspaceId, workspaceId)))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Journal not found');
  }

  await db
    .update(journals)
    .set({ deletedAt: new Date() })
    .where(eq(journals.id, id));
}

/**
 * Get all journals for the current user.
 * @param userId - The user's ID
 * @returns List of journals with highlight counts
 */
export async function getMyJournals(userId: string): Promise<JournalWithCount[]> {
  const workspaceId = await resolveWorkspaceId(userId);

  const journalList = await db
    .select()
    .from(journals)
    .where(sql`workspace_id = ${workspaceId} AND deleted_at IS NULL`)
    .orderBy(desc(journals.createdAt));

  const journalsWithCounts = await Promise.all(
    journalList.map(async (journal) => {
      const [countResult] = await db
        .select({ count: count() })
        .from(journalHighlights)
        .where(eq(journalHighlights.journalId, journal.id))
        .limit(1);

      return {
        ...journal,
        highlightCount: Number(countResult?.count ?? 0),
      };
    })
  );

  return journalsWithCounts;
}

/**
 * Get a journal by ID with all highlights.
 * @param userId - The user's ID
 * @param id - The journal ID
 * @returns Full journal with highlights and document details
 * @throws NotFoundError if journal not found
 */
export async function getJournalById(userId: string, id: string): Promise<JournalFull> {
  const workspaceId = await resolveWorkspaceId(userId);

  const [journal] = await db
    .select()
    .from(journals)
    .where(and(eq(journals.id, id), eq(journals.workspaceId, workspaceId)))
    .limit(1);

  if (!journal) {
    throw new NotFoundError('Journal not found');
  }

  const journalHighlightsList = await db
    .select()
    .from(journalHighlights)
    .where(eq(journalHighlights.journalId, id))
    .orderBy(journalHighlights.position);

  const highlightsWithDetails = await Promise.all(
    journalHighlightsList.map(async (jh) => {
      const [highlight] = await db
        .select()
        .from(highlights)
        .where(eq(highlights.id, jh.highlightId))
        .limit(1);

      if (!highlight) {
        return null;
      }

      const [document] = await db
        .select()
        .from(documents)
        .where(eq(documents.id, highlight.documentId))
        .limit(1);

      const author = document
        ? await db
            .select()
            .from(profiles)
            .where(eq(profiles.id, document.authorId))
            .limit(1)
        : null;

      return {
        ...jh,
        highlight: {
          ...highlight,
          document: document
            ? {
                id: document.id,
                title: document.title,
                slug: document.slug,
                authorUsername: author?.[0]?.username ?? 'unknown',
              }
            : null,
        },
      };
    })
  );

  return {
    ...journal,
    highlights: highlightsWithDetails.filter((h): h is JournalHighlightWithDetails => h !== null),
  };
}

/**
 * Add a highlight to a journal.
 * @param userId - The user's ID
 * @param journalId - The journal ID
 * @param data - Contains highlightId and optional position
 * @returns The created journal_highlight relation
 * @throws NotFoundError if journal or highlight not found
 * @throws ConflictError if highlight already in journal
 */
export async function addHighlightToJournal(
  userId: string,
  journalId: string,
  data: AddHighlightInput
): Promise<JournalHighlight> {
  const workspaceId = await resolveWorkspaceId(userId);

  const [journal] = await db
    .select()
    .from(journals)
    .where(and(eq(journals.id, journalId), eq(journals.workspaceId, workspaceId)))
    .limit(1);

  if (!journal) {
    throw new NotFoundError('Journal not found');
  }

  const [highlight] = await db
    .select()
    .from(highlights)
    .where(and(eq(highlights.id, data.highlightId), eq(highlights.userId, userId)))
    .limit(1);

  if (!highlight) {
    throw new NotFoundError('Highlight not found');
  }

  const [existing] = await db
    .select()
    .from(journalHighlights)
    .where(
      and(
        eq(journalHighlights.journalId, journalId),
        eq(journalHighlights.highlightId, data.highlightId)
      )
    )
    .limit(1);

  if (existing) {
    throw new ConflictError('Highlight already in this journal');
  }

  let position: number;
  if (data.position !== undefined) {
    position = data.position;
  } else {
    const [maxPos] = await db
      .select({ maxPos: sql<number>`MAX(${journalHighlights.position})` })
      .from(journalHighlights)
      .where(eq(journalHighlights.journalId, journalId))
      .limit(1);
    position = (maxPos?.maxPos ?? -1) + 1;
  }

  const [created] = await db
    .insert(journalHighlights)
    .values({
      id: createId(),
      journalId,
      highlightId: data.highlightId,
      position,
    })
    .returning();

  return created!;
}

/**
 * Remove a highlight from a journal.
 * @param userId - The user's ID
 * @param journalId - The journal ID
 * @param highlightId - The highlight ID to remove
 * @throws NotFoundError if journal or highlight not found in journal
 */
export async function removeHighlightFromJournal(
  userId: string,
  journalId: string,
  highlightId: string
): Promise<void> {
  const workspaceId = await resolveWorkspaceId(userId);

  const [journal] = await db
    .select()
    .from(journals)
    .where(and(eq(journals.id, journalId), eq(journals.workspaceId, workspaceId)))
    .limit(1);

  if (!journal) {
    throw new NotFoundError('Journal not found');
  }

  const [existing] = await db
    .select()
    .from(journalHighlights)
    .where(
      and(
        eq(journalHighlights.journalId, journalId),
        eq(journalHighlights.highlightId, highlightId)
      )
    )
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Highlight not found in journal');
  }

  await db
    .delete(journalHighlights)
    .where(
      and(
        eq(journalHighlights.journalId, journalId),
        eq(journalHighlights.highlightId, highlightId)
      )
    );

  const remaining = await db
    .select()
    .from(journalHighlights)
    .where(eq(journalHighlights.journalId, journalId))
    .orderBy(journalHighlights.position);

  for (let i = 0; i < remaining.length; i++) {
    await db
      .update(journalHighlights)
      .set({ position: i })
      .where(eq(journalHighlights.id, remaining[i]!.id));
  }
}

/**
 * Reorder highlights within a journal.
 * @param userId - The user's ID
 * @param journalId - The journal ID
 * @param data - Array of highlight IDs with new positions
 * @throws NotFoundError if journal not found or highlight IDs don't belong to journal
 */
export async function reorderHighlights(
  userId: string,
  journalId: string,
  data: ReorderHighlightsInput
): Promise<void> {
  const workspaceId = await resolveWorkspaceId(userId);

  const [journal] = await db
    .select()
    .from(journals)
    .where(and(eq(journals.id, journalId), eq(journals.workspaceId, workspaceId)))
    .limit(1);

  if (!journal) {
    throw new NotFoundError('Journal not found');
  }

  const existingHighlights = await db
    .select()
    .from(journalHighlights)
    .where(eq(journalHighlights.journalId, journalId));

  const existingIds = new Set(existingHighlights.map((h) => h.highlightId));
  for (const item of data.highlights) {
    if (!existingIds.has(item.id)) {
      throw new NotFoundError(`Highlight ${item.id} not found in journal`);
    }
  }

  for (const item of data.highlights) {
    await db
      .update(journalHighlights)
      .set({ position: item.position })
      .where(
        and(
          eq(journalHighlights.journalId, journalId),
          eq(journalHighlights.highlightId, item.id)
        )
      );
  }
}
