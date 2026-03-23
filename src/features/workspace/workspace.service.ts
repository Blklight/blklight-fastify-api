import { eq, and, count, sql } from 'drizzle-orm';
import { db } from '../../db/index';
import { workspaces, Workspace } from './workspace.schema';
import { highlights } from '../highlights/highlights.schema';
import { journals } from '../journals/journals.schema';
import { ValidationError } from '../../utils/errors';
import { NOTE_COLORS } from '../../config/note-colors';
import type { UpdateColorLabelsInput } from './workspace.zod';

export interface WorkspaceSummary {
  workspace: Workspace;
  counts: {
    notes: number;
    highlights: number;
    journals: number;
  };
}

/**
 * Get the current user's personal workspace with content counts.
 * @param userId - The user's ID
 * @returns Workspace with note, highlight, and journal counts
 */
export async function getMyWorkspace(userId: string): Promise<WorkspaceSummary> {
  const [ws] = await db
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.ownerId, userId), eq(workspaces.isPersonal, true)))
    .limit(1);

  if (!ws) {
    throw new ValidationError('Workspace not found');
  }

  const [notesCount] = await db
    .select({ count: count() })
    .from(sql`notes`)
    .where(sql`workspace_id = ${ws.id} AND deleted_at IS NULL`)
    .limit(1);

  const [highlightsCount] = await db
    .select({ count: count() })
    .from(highlights)
    .where(eq(highlights.userId, userId))
    .limit(1);

  const [journalsCount] = await db
    .select({ count: count() })
    .from(journals)
    .where(sql`workspace_id = ${ws.id} AND deleted_at IS NULL`)
    .limit(1);

  return {
    workspace: ws,
    counts: {
      notes: Number(notesCount?.count ?? 0),
      highlights: Number(highlightsCount?.count ?? 0),
      journals: Number(journalsCount?.count ?? 0),
    },
  };
}

/**
 * Update color labels on the user's workspace.
 * @param userId - The user's ID
 * @param colorLabels - Color label mapping or null to clear
 */
export async function updateColorLabels(
  userId: string,
  colorLabels: UpdateColorLabelsInput['colorLabels']
): Promise<void> {
  const [ws] = await db
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.ownerId, userId), eq(workspaces.isPersonal, true)))
    .limit(1);

  if (!ws) {
    throw new ValidationError('Workspace not found');
  }

  if (colorLabels !== null) {
    for (const key of Object.keys(colorLabels)) {
      if (!NOTE_COLORS.includes(key as typeof NOTE_COLORS[number])) {
        throw new ValidationError(`Invalid color: ${key}`);
      }
    }
  }

  await db
    .update(workspaces)
    .set({ colorLabels, updatedAt: new Date() })
    .where(eq(workspaces.id, ws.id));
}

/**
 * Resolve workspace ID for a user.
 * @param userId - The user's ID
 * @returns Workspace ID
 */
export async function resolveWorkspaceId(userId: string): Promise<string> {
  const [ws] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(and(eq(workspaces.ownerId, userId), eq(workspaces.isPersonal, true)))
    .limit(1);

  if (!ws) {
    throw new ValidationError('Workspace not found');
  }

  return ws.id;
}
