import { pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { documents } from '../documents/documents.schema';
import { profiles } from '../profiles/profiles.schema';

export const documentLikes = pgTable('document_likes', {
  id: text('id').primaryKey(),
  profileId: text('profile_id').notNull().references(() => profiles.id),
  documentId: text('document_id').notNull().references(() => documents.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  profileDocumentUnique: unique().on(table.profileId, table.documentId),
}));

export type DocumentLike = typeof documentLikes.$inferSelect;
export type NewDocumentLike = typeof documentLikes.$inferInsert;
