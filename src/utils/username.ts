import { sql, type AnyColumn, type SQL } from 'drizzle-orm';
import { z } from 'zod';

/**
 * Usernames that cannot be claimed by users.
 *
 * They collide with platform routes ("/api", "/feed"), product areas and
 * platform keywords, so claiming one would break navigation or impersonate a
 * system identity.
 *
 * The list is enforced by `usernameSchema` only — never by `createUser`,
 * because the legacy seed and the dev scripts create the "admin" account
 * through it.
 */
export const RESERVED_USERNAMES: readonly string[] = [
  'admin',
  'api',
  'feed',
  'escrever',
  'org',
  'dashboard',
  'onboarding',
  'design',
  'examples',
  'projects',
  'lab',
  'masks',
  'componentes',
  'login',
  'register',
  'logout',
  'signup',
  'signin',
  'settings',
  'me',
  'root',
  'system',
  'support',
  'blklight',
  'null',
  'undefined',
  '_next',
];

/**
 * Field-level message returned when a reserved username is submitted.
 */
export const RESERVED_USERNAME_MESSAGE = 'Este nome de usuário não está disponível';

const reservedUsernames = new Set(RESERVED_USERNAMES);

/**
 * Normalize a username to its canonical form: trimmed and lowercase.
 * Every write path and every username read goes through it, so a username has
 * exactly one spelling in the database.
 * @param username - Raw username coming from a request or a script
 * @returns The normalized username
 */
export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

/**
 * Check whether a username is reserved.
 * @param username - Username to check
 * @returns True when the normalized username is reserved
 */
export function isReservedUsername(username: string): boolean {
  return reservedUsernames.has(normalizeUsername(username));
}

/**
 * Case-insensitive username comparison for SQL conditions.
 *
 * Usernames are canonicalized to lowercase on write, but rows created before
 * that rule may still carry mixed case, so reads match with `lower()`.
 * @param column - The username column to compare against
 * @param username - The username to look for
 * @returns A SQL condition matching the username regardless of case
 */
export function matchUsername(column: AnyColumn, username: string): SQL {
  return sql`lower(${column}) = ${normalizeUsername(username)}`;
}

/**
 * Canonical username schema shared by every user-facing username input.
 *
 * The order matters: trim and lowercase run before the length and regex
 * checks, so "  Admin  " is rejected as reserved instead of slipping past the
 * format rules, and "  John  " is stored as "john".
 */
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must be at most 30 characters')
  .regex(/^[a-z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
  .refine((value) => !reservedUsernames.has(value), {
    message: RESERVED_USERNAME_MESSAGE,
  });
