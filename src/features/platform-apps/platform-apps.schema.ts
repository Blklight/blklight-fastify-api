import { pgTable, text, timestamp, boolean, unique } from 'drizzle-orm/pg-core';
import { users } from '../auth/auth.schema';

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
  userId: text('user_id').notNull().references(() => users.id),
  appId: text('app_id').notNull().references(() => platformApps.id),
  activatedAt: timestamp('activated_at').defaultNow().notNull(),
}, (table) => ({
  userAppUnique: unique().on(table.userId, table.appId),
}));

export type PlatformApp = typeof platformApps.$inferSelect;
export type NewPlatformApp = typeof platformApps.$inferInsert;
export type UserApp = typeof userApps.$inferSelect;
export type NewUserApp = typeof userApps.$inferInsert;