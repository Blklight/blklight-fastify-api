import { eq, and, isNull, desc, lt, sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { db } from '../../db/index';
import { notes, Note } from './notes.schema';
import { resolveCanvasId } from '../canvas/canvas.service';
import { NotFoundError } from '../../utils/errors';
import { encodeCursor, decodeCursor } from '../../utils/cursor';
import type { CreateNoteInput, UpdateNoteInput } from './notes.zod';

export interface NoteParams {
  cursor?: string;
  limit?: number;
  type?: string;
  color?: string;
}

export interface NoteResult {
  items: Note[];
  nextCursor: string | null;
  total: number;
}

/**
 * Create a new note in the user's workspace.
 * @param userId - The user's ID
 * @param data - Note data
 * @returns Created note
 */
export async function createNote(userId: string, data: CreateNoteInput): Promise<Note> {
  const canvasId = await resolveCanvasId(userId);
  const now = new Date();

  const [note] = await db
    .insert(notes)
    .values({
      id: createId(),
      canvasId,
      title: data.title ?? null,
      content: data.content,
      type: data.type ?? 'text',
      language: data.language ?? null,
      color: data.color ?? 'yellow',
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return note!;
}

/**
 * Update a note.
 * @param userId - The user's ID
 * @param id - Note ID
 * @param data - Fields to update
 * @returns Updated note
 */
export async function updateNote(userId: string, id: string, data: UpdateNoteInput): Promise<Note> {
  const canvasId = await resolveCanvasId(userId);

  const [existing] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, id), eq(notes.canvasId, canvasId), isNull(notes.deletedAt)))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Note not found');
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (data.title !== undefined) updates.title = data.title;
  if (data.content !== undefined) updates.content = data.content;
  if (data.type !== undefined) updates.type = data.type;
  if (data.language !== undefined) updates.language = data.language;
  if (data.color !== undefined) updates.color = data.color;

  await db
    .update(notes)
    .set(updates)
    .where(eq(notes.id, id));

  const [updated] = await db
    .select()
    .from(notes)
    .where(eq(notes.id, id))
    .limit(1);

  return updated!;
}

/**
 * Soft delete a note.
 * @param userId - The user's ID
 * @param id - Note ID
 */
export async function deleteNote(userId: string, id: string): Promise<void> {
  const canvasId = await resolveCanvasId(userId);

  const [existing] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, id), eq(notes.canvasId, canvasId), isNull(notes.deletedAt)))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Note not found');
  }

  await db
    .update(notes)
    .set({ deletedAt: new Date() })
    .where(eq(notes.id, id));
}

/**
 * Get all notes for the user's workspace with pagination and filters.
 * @param userId - The user's ID
 * @param params - Query params
 * @returns Paginated notes
 */
export async function getMyNotes(userId: string, params: NoteParams): Promise<NoteResult> {
  const canvasId = await resolveCanvasId(userId);
  const limit = Math.min(params.limit ?? 20, 50);
  const conditions: ReturnType<typeof eq>[] = [];

  conditions.push(eq(notes.canvasId, canvasId));
  conditions.push(isNull(notes.deletedAt));

  if (params.type) {
    conditions.push(eq(notes.type, params.type));
  }

  if (params.color) {
    conditions.push(eq(notes.color, params.color));
  }

  if (params.cursor) {
    const { timestamp, id } = decodeCursor(params.cursor);
    conditions.push(lt(notes.updatedAt, timestamp));
  }

  let results = await db
    .select()
    .from(notes)
    .where(and(...conditions))
    .orderBy(desc(notes.updatedAt), desc(notes.id))
    .limit(limit + 1);

  if (params.cursor && results.length > limit) {
    const { timestamp, id } = decodeCursor(params.cursor);
    results = results.filter(
      (r) => r.updatedAt > timestamp || (r.updatedAt.getTime() === timestamp.getTime() && r.id < id)
    );
  }

  const hasMore = results.length > limit;
  if (hasMore) {
    results.pop();
  }

  const items = results;
  const lastResult = results[results.length - 1];
  const nextCursor = hasMore && lastResult
    ? encodeCursor(lastResult.updatedAt, lastResult.id)
    : null;

  const countConditions = [eq(notes.canvasId, canvasId), isNull(notes.deletedAt)];
  if (params.type) countConditions.push(eq(notes.type, params.type));
  if (params.color) countConditions.push(eq(notes.color, params.color));

  const [countResult] = await db
    .select({ count: notes.id })
    .from(notes)
    .where(and(...countConditions));

  const total = results.length;

  return { items, nextCursor, total };
}

/**
 * Get a single note by ID.
 * @param userId - The user's ID
 * @param id - Note ID
 * @returns Note
 */
export async function getNoteById(userId: string, id: string): Promise<Note> {
  const canvasId = await resolveCanvasId(userId);

  const [note] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, id), eq(notes.canvasId, canvasId), isNull(notes.deletedAt)))
    .limit(1);

  if (!note) {
    throw new NotFoundError('Note not found');
  }

  return note;
}
