import { pgTable, text, timestamp, jsonb, boolean } from 'drizzle-orm/pg-core';
import { users } from '../auth/auth.schema';

export const profiles = pgTable('profiles', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().unique().references(() => users.id),
  username: text('username').notNull().unique(),
  displayName: text('display_name'),
  bio: text('bio'),
  bioPrivate: text('bio_private'),
  avatarUrl: text('avatar_url'),
  socialLinks: jsonb('social_links'),
  isPrivate: boolean('is_private').default(false).notNull(),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
