import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { config } from 'dotenv';

config({ path: '.env.development', override: true });
const SQL_URL = process.env.DATABASE_URL ?? '';

/**
 * End-to-end integration tests for username canonicalization.
 *
 * The behaviour under test spans the route, the Zod schema, the service layer
 * and SQL, so the suite drives the real HTTP surface (`app.inject`) against
 * the real dev database. Every row created here is namespaced with a per-run
 * prefix and hard-deleted in afterAll.
 */
vi.mock('../../src/config/env', async () => {
  const { config: loadEnv } = await import('dotenv');
  loadEnv({ path: '.env.development', override: true });
  process.env.NODE_ENV = 'development';

  const actual = await vi.importActual<typeof import('../../src/config/env')>(
    '../../src/config/env'
  );

  return {
    ...actual,
    env: {
      ...actual.env,
      FEATURE_EMAIL: false,
      FEATURE_OAUTH: false,
      FEATURE_MEMORY: false,
      RATE_LIMIT_DOCS_CREATE_MAX: 1000,
      RATE_LIMIT_DOCS_PUBLISH_MAX: 1000,
      LOG_LEVEL: 'silent',
    },
  };
});

import postgres from 'postgres';
import { eq, inArray, like } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { db } from '../../src/db/index';
import { env } from '../../src/config/env';
import { buildApp } from '../../src/app';
import { createUser } from '../../src/features/auth/auth.service';
import { users, sessions } from '../../src/features/auth/auth.schema';
import { profiles } from '../../src/features/profiles/profiles.schema';
import { signatures } from '../../src/features/signatures/signatures.schema';
import { workspaces } from '../../src/features/workspace/workspace.schema';
import { canvas } from '../../src/features/canvas/canvas.schema';
import {
  documents,
  documentStyles,
} from '../../src/features/documents/documents.schema';
import { documentCategories } from '../../src/features/categories/categories.schema';
import { documentTags } from '../../src/features/tags/tags.schema';
import { documentLikes } from '../../src/features/likes/likes.schema';
import { documentBookmarks } from '../../src/features/bookmarks/bookmarks.schema';
import {
  emailVerifications,
  passwordResets,
  emailQueue,
} from '../../src/features/email/email.schema';
import { RESERVED_USERNAME_MESSAGE } from '../../src/utils/username';
import type { FastifyInstance } from 'fastify';

const sql = postgres(SQL_URL, { max: 1 });

const RUN_ID = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const PREFIX = `uname-${RUN_ID}-`;

const PASSWORD = 'Password123!';

let app: FastifyInstance;

interface Account {
  userId: string;
  profileId: string;
  username: string;
  email: string;
  token: string;
}

function makeUsername(label: string): string {
  return `${PREFIX}${label}`.replace(/[^a-z0-9_]/g, '_').slice(0, 30);
}

/**
 * Usernames asserted on normalization must be unique per run, otherwise a
 * leftover row from a previous run makes the assertion fail on a conflict
 * instead of on the behavior under test.
 */
function uniqueUsername(label: string): string {
  return `${label}${RUN_ID}`.replace(/[^a-z0-9_]/g, '_').toLowerCase().slice(0, 30);
}

async function createAccount(label: string): Promise<Account> {
  const email = `${PREFIX}${label}@example.test`;
  const username = makeUsername(label);
  const { user } = await createUser(email, username, PASSWORD);

  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, user.id))
    .limit(1);

  const token = app.jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN }
  );

  return { userId: user.id, profileId: profile!.id, username: profile!.username, email, token };
}

async function api(
  account: Account | null,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  payload?: unknown
) {
  return app.inject({
    method,
    url,
    headers: account ? { authorization: `Bearer ${account.token}` } : {},
    payload: payload as never,
  });
}

/**
 * Delete every row this run created.
 *
 * The lookup is by the run prefix, not by the ids collected while the tests
 * were running: a row created before an assertion blew up never reached a
 * tracking array, but it still carries the prefix, so the prefix lookup is
 * the only cleanup that survives a failing test.
 */
async function deleteRunRows(): Promise<void> {
  const created = await db
    .select({ id: users.id })
    .from(users)
    .where(like(users.email, `${PREFIX}%`));

  const userIds = created.map((row) => row.id);

  if (userIds.length > 0) {
    await db.delete(emailVerifications).where(inArray(emailVerifications.userId, userIds));
    await db.delete(passwordResets).where(inArray(passwordResets.userId, userIds));
    await db.delete(sessions).where(inArray(sessions.userId, userIds));
    await db.delete(signatures).where(inArray(signatures.userId, userIds));

    // Workspaces and canvas rows are created by createUser in the same
    // transaction as the account, so they are looked up by owner instead of
    // being tracked one by one.
    const owned = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(inArray(workspaces.ownerId, userIds));
    const ownedIds = owned.map((row) => row.id);

    if (ownedIds.length > 0) {
      await db.delete(canvas).where(inArray(canvas.workspaceId, ownedIds));
      await db.delete(workspaces).where(inArray(workspaces.id, ownedIds));
    }

    const ownedProfiles = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(inArray(profiles.userId, userIds));
    const profileIds = ownedProfiles.map((row) => row.id);

    if (profileIds.length > 0) {
      const ownedDocuments = await db
        .select({ id: documents.id })
        .from(documents)
        .where(inArray(documents.authorId, profileIds));
      const documentIds = ownedDocuments.map((row) => row.id);

      if (documentIds.length > 0) {
        await db.delete(documentLikes).where(inArray(documentLikes.documentId, documentIds));
        await db.delete(documentBookmarks).where(inArray(documentBookmarks.documentId, documentIds));
        await db.delete(documentCategories).where(inArray(documentCategories.documentId, documentIds));
        await db.delete(documentTags).where(inArray(documentTags.documentId, documentIds));
        await db.delete(documentStyles).where(inArray(documentStyles.documentId, documentIds));
        await db.delete(documents).where(inArray(documents.id, documentIds));
      }

      await db.delete(profiles).where(inArray(profiles.id, profileIds));
    }

    await db.delete(users).where(inArray(users.id, userIds));
  }

  await db.delete(emailQueue).where(like(emailQueue.to, `${PREFIX}%`));
}

beforeAll(async () => {
  expect(SQL_URL).not.toBe('');
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await deleteRunRows();

  const leftover = await db
    .select({ id: users.id })
    .from(users)
    .where(like(users.email, `${PREFIX}%`));
  expect(leftover).toHaveLength(0);

  await app.close();
  await sql.end();
});

describe('username canonicalization (integration)', () => {
  it('stores the username lowercase on register', async () => {
    const email = `${PREFIX}mixed@example.test`;
    const expected = uniqueUsername('mixed');
    const res = await api(null, 'POST', '/api/v1/auth/register', {
      email,
      username: `  ${expected.toUpperCase()}  `,
      password: PASSWORD,
    });

    expect(res.statusCode).toBe(201);
    const body = res.json() as { data: { user: { username: string } } };
    expect(body.data.user.username).toBe(expected);

    const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    expect(row!.username).toBe(expected);

    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, row!.id))
      .limit(1);
    expect(profile!.username).toBe(expected);
  });

  it('rejects a reserved username on register with a field-level message', async () => {
    const email = `${PREFIX}reserved@example.test`;
    const res = await api(null, 'POST', '/api/v1/auth/register', {
      email,
      username: 'Admin',
      password: PASSWORD,
    });

    expect(res.statusCode).toBe(400);
    const body = res.json() as { error: { code: string; fields?: Record<string, string> } };
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.fields?.username).toBe(RESERVED_USERNAME_MESSAGE);

    const rows = await db.select().from(users).where(eq(users.email, email));
    expect(rows).toHaveLength(0);
  });

  it('rejects a reserved username on OAuth onboarding', async () => {
    const userId = createId();
    const email = `${PREFIX}oauth@example.test`;

    await db.insert(users).values({
      id: userId,
      email,
      username: `github_${Date.now()}`,
      passwordHash: null,
      salt: null,
      onboardingComplete: false,
    });

    const token = app.jwt.sign(
      { userId, email, role: 'user' },
      { expiresIn: env.JWT_ACCESS_EXPIRES_IN }
    );
    const account: Account = { userId, profileId: '', username: '', email, token };

    const res = await api(account, 'POST', '/api/v1/auth/onboarding/username', {
      username: '  FEED  ',
    });

    expect(res.statusCode).toBe(400);
    const body = res.json() as { error: { code: string; fields?: Record<string, string> } };
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.fields?.username).toBe(RESERVED_USERNAME_MESSAGE);

    const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    expect(row!.username).not.toBe('feed');
  });

  it('normalizes the username chosen during OAuth onboarding', async () => {
    const userId = createId();
    const email = `${PREFIX}oauth2@example.test`;
    const expected = uniqueUsername('onboard');

    await db.insert(users).values({
      id: userId,
      email,
      username: `github_${Date.now()}`,
      passwordHash: null,
      salt: null,
      onboardingComplete: false,
    });

    const token = app.jwt.sign(
      { userId, email, role: 'user' },
      { expiresIn: env.JWT_ACCESS_EXPIRES_IN }
    );
    const account: Account = { userId, profileId: '', username: '', email, token };

    const res = await api(account, 'POST', '/api/v1/auth/onboarding/username', {
      username: `  ${expected.toUpperCase()}  `,
    });

    expect(res.statusCode).toBe(200);

    const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    expect(row!.username).toBe(expected);
  });

  it('serves a public profile when the username is typed in uppercase', async () => {
    const account = await createAccount('read');

    const res = await api(null, 'GET', `/api/v1/profiles/${account.username.toUpperCase()}`);

    expect(res.statusCode).toBe(200);
    const body = res.json() as { data: { username: string } };
    expect(body.data.username).toBe(account.username);
  });

  it('serves the author documents list when the username is typed in uppercase', async () => {
    const account = await createAccount('docs');

    const res = await api(null, 'GET', `/api/v1/profiles/${account.username.toUpperCase()}/documents`);

    expect(res.statusCode).toBe(200);
    const body = res.json() as { data: { items: unknown[] } };
    expect(Array.isArray(body.data.items)).toBe(true);
  });

  it('normalizes the username on profile update', async () => {
    const account = await createAccount('rename');
    const expected = uniqueUsername('renamed');

    const res = await api(account, 'PATCH', '/api/v1/profiles/me', {
      username: `  ${expected.toUpperCase()}  `,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { data: { username: string } };
    expect(body.data.username).toBe(expected);
  });

  it('rejects a reserved username on profile update', async () => {
    const account = await createAccount('renamereserved');

    const res = await api(account, 'PATCH', '/api/v1/profiles/me', { username: 'Dashboard' });

    expect(res.statusCode).toBe(400);
    const body = res.json() as { error: { code: string; fields?: Record<string, string> } };
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.fields?.username).toBe(RESERVED_USERNAME_MESSAGE);
  });

  it('lowercases the username inside createUser, without enforcing the reserved list', async () => {
    const email = `${PREFIX}service@example.test`;
    const expected = uniqueUsername('service');
    const { user } = await createUser(email, `  ${expected.toUpperCase()}  `, PASSWORD);

    expect(user.username).toBe(expected);

    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, user.id))
      .limit(1);
    expect(profile!.username).toBe(expected);
  });

  it('logs in with an uppercase username', async () => {
    const account = await createAccount('login');

    const res = await api(null, 'POST', '/api/v1/auth/login', {
      identifier: account.username.toUpperCase(),
      password: PASSWORD,
    });

    expect(res.statusCode).toBe(200);
  });
});
