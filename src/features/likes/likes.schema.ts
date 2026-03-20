import { pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { documents } from '../documents/documents.schema';
import { users } from '../auth/auth.schema';

export const documentLikes = pgTable('document_likes', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  documentId: text('document_id').notNull().references(() => documents.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userDocumentUnique: unique().on(table.userId, table.documentId),
}));

export type DocumentLike = typeof documentLikes.$inferSelect;
export type NewDocumentLike = typeof documentLikes.$inferInsert;
