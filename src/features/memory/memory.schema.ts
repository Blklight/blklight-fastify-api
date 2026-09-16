import { pgTable, text, timestamp, unique, index, vector } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from '../auth/auth.schema';

export const embeddings = pgTable('embeddings', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  sourceType: text('source_type').notNull(),
  sourceId: text('source_id').notNull(),
  embedding: vector('embedding', { dimensions: 768 }).notNull(),
  indexedAt: timestamp('indexed_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userSourceUnique: unique().on(table.userId, table.sourceType, table.sourceId),
  embeddingHnswIndex: index('embeddings_embedding_hnsw_index').using('hnsw', sql`${table.embedding} vector_cosine_ops`),
}));

export type Embedding = typeof embeddings.$inferSelect;
export type NewEmbedding = typeof embeddings.$inferInsert;