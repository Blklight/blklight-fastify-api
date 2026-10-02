import { pgTable, pgEnum, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import '../signatures/signatures.schema';

export const userRoleEnum = pgEnum('user_role', ['user', 'admin']);

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash'),
  salt: text('salt'),
  emailVerified: boolean('email_verified').default(false).notNull(),
  role: userRoleEnum('role').default('user').notNull(),
  githubId: text('github_id').unique(),
  googleId: text('google_id').unique(),
  onboardingComplete: boolean('onboarding_complete').default(false).notNull(),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id),
    /**
     * SHA-256 hex of the refresh token, never the token itself. The plaintext
     * only ever exists in the httpOnly cookie and in the Set-Cookie response;
     * a database leak therefore yields no usable session.
     */
    refreshToken: text('refresh_token').notNull().unique(),
    /**
     * Stable id shared by every token in one rotation chain. A login, register
     * or OAuth callback starts a new family; each refresh inserts a new row with
     * the same family_id. Logout and reuse detection act on the whole family.
     */
    familyId: text('family_id').notNull(),
    /** Set on the superseded token when a rotation happens; null while active. */
    rotatedAt: timestamp('rotated_at'),
    /** Persisted so rotations keep extending the session with the same TTL. */
    rememberMe: boolean('remember_me').default(false).notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('sessions_user_id_idx').on(table.userId),
    familyIdIdx: index('sessions_family_id_idx').on(table.familyId),
  })
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
