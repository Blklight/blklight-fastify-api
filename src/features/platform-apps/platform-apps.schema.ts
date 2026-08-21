import { pgTable, text, timestamp, boolean, unique } from 'drizzle-orm/pg-core';
import { profiles } from '../profiles/profiles.schema';

export const platformApps = pgTable('platform_apps', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  accessMode: text('access_mode').notNull().default('open'),
  iconUrl: text('icon_url'),
  tagline: text('tagline'),
  category: text('category'),
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

export const appInvites = pgTable('app_invites', {
  id: text('id').primaryKey(),
  appId: text('app_id').notNull().references(() => platformApps.id, { onDelete: 'cascade' }),
  profileId: text('profile_id').notNull().references(() => profiles.id),
  invitedBy: text('invited_by').notNull().references(() => profiles.id),
  status: text('status').notNull().default('accepted'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  decidedAt: timestamp('decided_at'),
}, (table) => ({
  appProfileUnique: unique().on(table.appId, table.profileId),
}));

export type PlatformApp = typeof platformApps.$inferSelect;
export type NewPlatformApp = typeof platformApps.$inferInsert;
export type UserApp = typeof userApps.$inferSelect;
export type NewUserApp = typeof userApps.$inferInsert;
export type AppInvite = typeof appInvites.$inferSelect;
export type NewAppInvite = typeof appInvites.$inferInsert;
