import { createId } from '@paralleldrive/cuid2';
import { eq, and } from 'drizzle-orm';
import { db } from '../../db/index';
import { workspaces } from '../workspace/workspace.schema';
import { canvas, canvasPositions, NewCanvasPosition } from './canvas.schema';
import { notes } from '../notes/notes.schema';

export interface NoteWithPosition {
  id: string;
  title: string | null;
  content: string;
  type: string;
  language: string | null;
  color: string;
  createdAt: Date;
  updatedAt: Date;
  position: {
    x: number;
    y: number;
    w: number;
    h: number;
    z: number;
  } | null;
}

export interface CanvasFull {
  id: string;
  workspaceId: string;
  notes: NoteWithPosition[];
}

export async function resolveCanvasId(userId: string): Promise<string> {
  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.ownerId, userId))
    .limit(1);

  if (!workspace) {
    throw new Error('Workspace not found');
  }

  const [canvasRow] = await db
    .select()
    .from(canvas)
    .where(eq(canvas.workspaceId, workspace.id))
    .limit(1);

  if (!canvasRow) {
    throw new Error('Canvas not found');
  }

  return canvasRow.id;
}

export async function getMyCanvas(userId: string): Promise<CanvasFull> {
  const canvasId = await resolveCanvasId(userId);

  const [canvasRow] = await db
    .select()
    .from(canvas)
    .where(eq(canvas.id, canvasId))
    .limit(1);

  if (!canvasRow) {
    throw new Error('Canvas not found');
  }

  const userNotes = await db
    .select()
    .from(notes)
    .where(eq(notes.canvasId, canvasId));

  const noteIds = userNotes.map(n => n.id);
  
  const positions = await db
    .select()
    .from(canvasPositions)
    .where(eq(canvasPositions.canvasId, canvasId));

  const positionByNoteId = new Map(positions.map(p => [p.noteId, p]));

  const notesWithPositions: NoteWithPosition[] = userNotes.map(note => {
    const pos = positionByNoteId.get(note.id);
    return {
      id: note.id,
      title: note.title,
      content: note.content,
      type: note.type,
      language: note.language,
      color: note.color,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      position: pos ? {
        x: pos.x,
        y: pos.y,
        w: pos.w ?? 200,
        h: pos.h ?? 150,
        z: pos.z ?? 0,
      } : null,
    };
  });

  return {
    id: canvasRow.id,
    workspaceId: canvasRow.workspaceId,
    notes: notesWithPositions,
  };
}

export interface PositionUpdate {
  noteId: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  z?: number;
}

export async function updatePositions(userId: string, positions: PositionUpdate[]): Promise<void> {
  const canvasId = await resolveCanvasId(userId);

  const validNoteIds = new Set(
    (await db
      .select({ id: notes.id })
      .from(notes)
      .where(eq(notes.canvasId, canvasId)))
    .map(n => n.id)
  );

  for (const pos of positions) {
    if (!validNoteIds.has(pos.noteId)) {
      throw new Error(`Note ${pos.noteId} not found in user's canvas`);
    }
  }

  for (const pos of positions) {
    await db
      .insert(canvasPositions)
      .values({
        id: createId(),
        canvasId,
        noteId: pos.noteId,
        x: pos.x,
        y: pos.y,
        w: pos.w ?? 200,
        h: pos.h ?? 150,
        z: pos.z ?? 0,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: canvasPositions.noteId,
        set: {
          x: pos.x,
          y: pos.y,
          w: pos.w,
          h: pos.h,
          z: pos.z,
          updatedAt: new Date(),
        },
      });
  }
}