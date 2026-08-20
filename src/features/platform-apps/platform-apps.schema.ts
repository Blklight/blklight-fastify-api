import { pgTable, text, timestamp, boolean, unique } from 'drizzle-orm/pg-core';
import { profiles } from '../profiles/profiles.schema';

export const platformApps = pgTable('platform_apps', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const userApps = pgTable('user_apps', {
  id: text('id').primaryKey(),
  profileId: text('profile_id').notNull().references(() => profiles.id),
  appId: text('app_id').notNull().references(() => platformApps.id),
  activatedAt: timestamp('activated_at').defaultNow().notNull(),
}, (table) => ({
  profileAppUnique: unique().on(table.profileId, table.appId),
}));

export type PlatformApp = typeof platformApps.$inferSelect;
export type NewPlatformApp = typeof platformApps.$inferInsert;
export type UserApp = typeof userApps.$inferSelect;
export type NewUserApp = typeof userApps.$inferInsert;
