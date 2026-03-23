import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { workspaces } from '../workspace/workspace.schema';

export const notes = pgTable('notes', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  title: text('title'),
  content: text('content').notNull(),
  type: text('type').default('text').notNull(),
  language: text('language'),
  color: text('color').default('yellow').notNull(),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
