import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { users } from '../auth/auth.schema';
import { documents } from '../documents/documents.schema';

export const highlights = pgTable('highlights', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  documentId: text('document_id').notNull().references(() => documents.id),
  selection: jsonb('selection').notNull(),
  annotation: jsonb('annotation'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const highlightPalette = pgTable('highlight_palette', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().unique().references(() => users.id),
  colors: jsonb('colors').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type Highlight = typeof highlights.$inferSelect;
export type NewHighlight = typeof highlights.$inferInsert;
export type HighlightPalette = typeof highlightPalette.$inferSelect;
export type NewHighlightPalette = typeof highlightPalette.$inferInsert;
