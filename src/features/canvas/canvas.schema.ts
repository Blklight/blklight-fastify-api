import { pgTable, text, timestamp, real, integer, unique } from 'drizzle-orm/pg-core';
import { workspaces } from '../workspace/workspace.schema';
import { notes } from '../notes/notes.schema';

export const canvas = pgTable('canvas', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().unique().references(() => workspaces.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const canvasPositions = pgTable('canvas_positions', {
  id: text('id').primaryKey(),
  canvasId: text('canvas_id').notNull().references(() => canvas.id),
  noteId: text('note_id').notNull().unique().references(() => notes.id),
  x: real('x').notNull().default(0),
  y: real('y').notNull().default(0),
  w: real('w').default(200),
  h: real('h').default(150),
  z: integer('z').default(0),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  canvasNoteUnique: unique().on(table.canvasId, table.noteId),
}));

export type Canvas = typeof canvas.$inferSelect;
export type NewCanvas = typeof canvas.$inferInsert;
export type CanvasPosition = typeof canvasPositions.$inferSelect;
export type NewCanvasPosition = typeof canvasPositions.$inferInsert;