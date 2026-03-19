import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const signatures = pgTable('signatures', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().unique(),
  userHash: text('user_hash').notNull().unique(),
  secretEncrypted: text('secret_encrypted').notNull(),
  txHash: text('tx_hash'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type Signature = typeof signatures.$inferSelect;
export type NewSignature = typeof signatures.$inferInsert;
