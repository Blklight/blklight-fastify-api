import { pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { users } from '../auth/auth.schema';

export const embeddings = pgTable('embeddings', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  sourceType: text('source_type').notNull(),
  sourceId: text('source_id').notNull(),
  embedding: text('embedding').notNull(),
  indexedAt: timestamp('indexed_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userSourceUnique: unique().on(table.userId, table.sourceType, table.sourceId),
}));

export type Embedding = typeof embeddings.$inferSelect;
export type NewEmbedding = typeof embeddings.$inferInsert;