import { pgTable, text, timestamp, jsonb, boolean, unique } from 'drizzle-orm/pg-core';
import { users } from '../auth/auth.schema';

export const workspaces = pgTable('workspaces', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull().unique().references(() => users.id),
  type: text('type').default('personal').notNull(),
  name: text('name').notNull(),
  isPersonal: boolean('is_personal').default(true).notNull(),
  colorLabels: jsonb('color_labels'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const workspaceMembers = pgTable('workspace_members', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  userId: text('user_id').notNull().references(() => users.id),
  role: text('role').default('member').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  workspaceUserUnique: unique().on(table.workspaceId, table.userId),
}));

export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;
export type WorkspaceMember = typeof workspaceMembers.$inferSelect;
export type NewWorkspaceMember = typeof workspaceMembers.$inferInsert;
