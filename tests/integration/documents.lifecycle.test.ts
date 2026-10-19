import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { config } from 'dotenv';

config({ path: '.env.development', override: true });
const SQL_URL = process.env.DATABASE_URL ?? '';

/**
 * End-to-end integration tests for the document lifecycle.
 *
 * These exercise the real HTTP surface (`app.inject`) against the real dev
 * database, because the behaviour under test is the contract between route,
 * Zod validation, service and SQL — a mocked db would only assert the mock.
 * All rows created here are namespaced with a per-run prefix and hard-deleted
 * in afterAll, so the suite leaves the database byte-identical.
 */
vi.mock('../../src/config/env', async () => {
  // env.ts resolves its dotenv file from NODE_ENV; vitest runs with
  // NODE_ENV=test. Pretend to be the dev process so the real implementation
  // loads .env.development, exactly like the running server.
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
      // The suite creates several documents; keep the per-user route limit
      // out of the way so 429s never masquerade as lifecycle failures.
      RATE_LIMIT_DOCS_CREATE_MAX: 1000,
      RATE_LIMIT_DOCS_PUBLISH_MAX: 1000,
      LOG_LEVEL: 'silent',
    },
  };
});

import postgres from 'postgres';
import { eq, inArray } from 'drizzle-orm';
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
import { documents, documentStyles, documentTypes } from '../../src/features/documents/documents.schema';
import { documentCategories, categories } from '../../src/features/categories/categories.schema';
import { documentTags, tags } from '../../src/features/tags/tags.schema';
import { documentLikes } from '../../src/features/likes/likes.schema';
import {
  emailVerifications,
  passwordResets,
  emailQueue,
} from '../../src/features/email/email.schema';
import type { FastifyInstance } from 'fastify';

const sql = postgres(SQL_URL, { max: 1 });

const RUN_ID = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const PREFIX = `itest-${RUN_ID}-`;

/**
 * The tables this suite can touch. Counted before the first write and again
 * after cleanup so the report can show the suite is side-effect free.
 */
const COUNTED_TABLES = [
  'users',
  'profiles',
  'signatures',
  'workspaces',
  'canvas',
  'sessions',
  'documents',
  'document_styles',
  'document_categories',
  'document_tags',
  'document_likes',
  'tags',
  'categories',
  'email_queue',
  'email_verifications',
  'password_resets',
] as const;

const STRICT_COUNTS = process.env.ITEST_STRICT_COUNTS === '1';

let app: FastifyInstance;
let baselineCounts: Record<string, number> = {};

const createdUserIds: string[] = [];
const createdProfileIds: string[] = [];
const createdWorkspaceIds: string[] = [];
const createdCanvasIds: string[] = [];
const createdDocumentIds: string[] = [];
const createdCategoryIds: string[] = [];
const createdTagNames: string[] = [];
const createdEmails: string[] = [];
let categoryId = '';

interface Account {
  userId: string;
  profileId: string;
  username: string;
  email: string;
  token: string;
}

function makeUsername(label: string): string {
  return `${PREFIX}${label}`.replace(/[^a-z0-9_]/g, '_').slice(0, 60);
}

async function createAccount(label: string): Promise<Account> {
  const email = `${PREFIX}${label}@example.test`;
  const username = makeUsername(label);
  const { user } = await createUser(email, username, 'Password123!');

  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, user.id))
    .limit(1);

  const [workspace] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.ownerId, user.id))
    .limit(1);

  createdUserIds.push(user.id);
  createdEmails.push(email);
  if (profile) createdProfileIds.push(profile.id);
  if (workspace) {
    createdWorkspaceIds.push(workspace.id);
    const [cv] = await db
      .select({ id: canvas.id })
      .from(canvas)
      .where(eq(canvas.workspaceId, workspace.id))
      .limit(1);
    if (cv) createdCanvasIds.push(cv.id);
  }

  const token = app.jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN }
  );

  return { userId: user.id, profileId: profile!.id, username: profile!.username, email, token };
}

function authHeaders(account: Account): Record<string, string> {
  return { authorization: `Bearer ${account.token}` };
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
    headers: account ? authHeaders(account) : {},
    payload: payload as never,
  });
}

async function createDraft(account: Account, title: string, withCategory = true) {
  const res = await api(account, 'POST', '/api/v1/documents', {
    title,
    type: 'article',
    content: { type: 'doc', content: [{ type: 'paragraph' }] },
    ...(withCategory ? { categoryId } : {}),
  });
  const body = res.json() as { data?: { id: string; slug: string } };
  if (body.data?.id) createdDocumentIds.push(body.data.id);
  return { id: body.data?.id ?? '', slug: body.data?.slug ?? '', res };
}

async function tableCounts(): Promise<Record<string, number>> {
  const entries = await Promise.all(
    COUNTED_TABLES.map(async (table) => {
      const rows = await sql.unsafe(`select count(*)::int as c from "${table}"`);
      return [table, rows[0]!.c as number] as const;
    })
  );
  return Object.fromEntries(entries);
}

async function waitForCountsToEqual(expected: Record<string, number>, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const current = await tableCounts();
    if (COUNTED_TABLES.every((t) => current[t] === expected[t])) return true;
    if (Date.now() > deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

beforeAll(async () => {
  expect(SQL_URL).not.toBe('');

  app = await buildApp();
  await app.ready();

  const articleType = await db
    .select()
    .from(documentTypes)
    .where(eq(documentTypes.name, 'article'))
    .limit(1);
  if (articleType.length === 0) {
    await db.insert(documentTypes).values({ id: createId(), name: 'article' });
  }

  baselineCounts = await tableCounts();

  // Created after the baseline snapshot and deleted in afterAll, so the run
  // nets to zero. Every document fixture needs a category to be publishable.
  const [category] = await db
    .insert(categories)
    .values({
      id: createId(),
      name: `${PREFIX}Category`,
      slug: `${PREFIX}category`,
      createdAt: new Date(),
    })
    .returning({ id: categories.id });
  categoryId = category!.id;
  createdCategoryIds.push(category!.id);
});

afterAll(async () => {
  // Hard delete by the run's own identifiers, children before parents.
  if (createdDocumentIds.length > 0) {
    await db.delete(documentLikes).where(inArray(documentLikes.documentId, createdDocumentIds));
    await db.delete(documentTags).where(inArray(documentTags.documentId, createdDocumentIds));
    await db.delete(documentCategories).where(inArray(documentCategories.documentId, createdDocumentIds));
    await db.delete(documentStyles).where(inArray(documentStyles.documentId, createdDocumentIds));
    await db.delete(documents).where(inArray(documents.id, createdDocumentIds));
  }
  if (createdTagNames.length > 0) {
    await db.delete(tags).where(inArray(tags.name, createdTagNames));
  }
  if (createdCategoryIds.length > 0) {
    await db.delete(categories).where(inArray(categories.id, createdCategoryIds));
  }
  if (createdUserIds.length > 0) {
    await db.delete(emailVerifications).where(inArray(emailVerifications.userId, createdUserIds));
    await db.delete(passwordResets).where(inArray(passwordResets.userId, createdUserIds));
    await db.delete(sessions).where(inArray(sessions.userId, createdUserIds));
    await db.delete(signatures).where(inArray(signatures.userId, createdUserIds));
  }
  if (createdEmails.length > 0) {
    await db.delete(emailQueue).where(inArray(emailQueue.to, createdEmails));
  }
  if (createdCanvasIds.length > 0) {
    await db.delete(canvas).where(inArray(canvas.id, createdCanvasIds));
  }
  if (createdWorkspaceIds.length > 0) {
    await db.delete(workspaces).where(inArray(workspaces.id, createdWorkspaceIds));
  }
  if (createdProfileIds.length > 0) {
    await db.delete(profiles).where(inArray(profiles.id, createdProfileIds));
  }
  if (createdUserIds.length > 0) {
    await db.delete(users).where(inArray(users.id, createdUserIds));
  }

  const after = await tableCounts();
  const diff: Record<string, { before: number; after: number }> = {};
  for (const table of COUNTED_TABLES) {
    if (after[table] !== baselineCounts[table]) {
      diff[table] = { before: baselineCounts[table]!, after: after[table]! };
    }
  }
  console.log('[itest] table counts before:', JSON.stringify(baselineCounts));
  console.log('[itest] table counts after :', JSON.stringify(after));
  console.log('[itest] count diff          :', JSON.stringify(diff));

  // Deterministic leak check: none of this run's rows may survive.
  expect(await countBy('users', 'id', createdUserIds)).toBe(0);
  expect(await countBy('profiles', 'id', createdProfileIds)).toBe(0);
  expect(await countBy('documents', 'id', createdDocumentIds)).toBe(0);
  expect(await countBy('workspaces', 'id', createdWorkspaceIds)).toBe(0);
  expect(await countBy('canvas', 'id', createdCanvasIds)).toBe(0);
  expect(await countBy('sessions', 'user_id', createdUserIds)).toBe(0);
  expect(await countBy('signatures', 'user_id', createdUserIds)).toBe(0);
  expect(await countBy('tags', 'name', createdTagNames)).toBe(0);
  expect(await countBy('categories', 'id', createdCategoryIds)).toBe(0);

  // Global count parity is only meaningful when no other DB-touching suite is
  // writing concurrently, so it is asserted on demand (isolated run).
  if (STRICT_COUNTS) {
    const equal = await waitForCountsToEqual(baselineCounts, 15_000);
    if (!equal) {
      console.error('[itest] strict count mismatch:', JSON.stringify(await tableCounts()));
    }
    expect(equal).toBe(true);
  }

  await app.close();
  await sql.end();
});

async function countBy(table: string, column: string, values: string[]): Promise<number> {
  if (values.length === 0) return 0;
  const rows = await sql.unsafe(
    `select count(*)::int as c from "${table}" where "${column}" = any($1)`,
    [values]
  );
  return rows[0]!.c as number;
}

describe('document lifecycle (integration)', () => {
  it('rejects unauthenticated create with 401', async () => {
    const res = await api(null, 'POST', '/api/v1/documents', { title: 'nope', type: 'article' });
    expect(res.statusCode).toBe(401);
  });

  it('creates a draft document with style', async () => {
    const account = await createAccount('create');
    const { id, slug, res } = await createDraft(account, `${PREFIX}Create Me`);

    expect(res.statusCode).toBe(201);
    const body = res.json() as { data: { id: string; status: string; slug: string; authorId: string; typeName: string; style: unknown } };
    expect(body.data.status).toBe('draft');
    expect(body.data.slug).toBeTruthy();
    expect(body.data.authorId).toBe(account.profileId);
    expect(body.data.typeName).toBe('article');
    expect(body.data.style).toBeDefined();
    expect(id).toBeTruthy();
    expect(slug).toBeTruthy();
  });

  it('autosaves content without publishing', async () => {
    const account = await createAccount('autosave');
    const { id } = await createDraft(account, `${PREFIX}Autosave`);

    const content = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hello' }] }] };
    const res = await api(account, 'PATCH', `/api/v1/documents/${id}`, { content });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { data: { status: string; content: Record<string, unknown> } };
    expect(body.data.status).toBe('draft');
    expect(body.data.content).toEqual(content);
  });

  it('publishes a document, setting authorship and publishedAt', async () => {
    const account = await createAccount('publish');
    const { id } = await createDraft(account, `${PREFIX}Publish Me`);

    const res = await api(account, 'PATCH', `/api/v1/documents/${id}/publish`);

    expect(res.statusCode).toBe(200);
    const body = res.json() as { data: { status: string; authorship: { documentHash: string; publicIdentifier: string } | null; publishedAt: string | null } };
    expect(body.data.status).toBe('published');
    expect(body.data.authorship?.documentHash).toBeTruthy();
    expect(body.data.authorship?.publicIdentifier).toMatch(/^PLT-/);
    expect(body.data.publishedAt).toBeTruthy();
  });

  it('editing published content keeps the document published', async () => {
    const account = await createAccount('editpub');
    const { id } = await createDraft(account, `${PREFIX}Edit Published`);

    const published = await api(account, 'PATCH', `/api/v1/documents/${id}/publish`);
    const before = published.json() as { data: { authorship: { publicIdentifier: string } } };

    const res = await api(account, 'PATCH', `/api/v1/documents/${id}`, {
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'edited' }] }] },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { data: { status: string; authorship: { publicIdentifier: string } | null } };
    expect(body.data.status).toBe('published');
    expect(body.data.authorship?.publicIdentifier).toBe(before.data.authorship.publicIdentifier);
  });

  it('soft-deletes a document and hides it from owner and public reads', async () => {
    const account = await createAccount('delete');
    const { id, slug } = await createDraft(account, `${PREFIX}Delete Me`);

    const del = await api(account, 'DELETE', `/api/v1/documents/${id}`);
    expect(del.statusCode).toBe(200);

    const owner = await api(account, 'GET', `/api/v1/documents/${id}`);
    expect(owner.statusCode).toBe(404);

    const pub = await api(null, 'GET', `/api/v1/documents/${account.username}/${slug}`);
    expect(pub.statusCode).toBe(404);
  });

  it('serves a published document publicly and 404s on unknown slug', async () => {
    const account = await createAccount('public');
    const { id, slug } = await createDraft(account, `${PREFIX}Public Read`);
    await api(account, 'PATCH', `/api/v1/documents/${id}/publish`);

    const res = await api(null, 'GET', `/api/v1/documents/${account.username}/${slug}`);
    expect(res.statusCode).toBe(200);
    const body = res.json() as { data: { slug: string; title: string; username: string } };
    expect(body.data.slug).toBe(slug);
    expect(body.data.title).toBe(`${PREFIX}Public Read`);

    const missing = await api(null, 'GET', `/api/v1/documents/${account.username}/does-not-exist`);
    expect(missing.statusCode).toBe(404);
  });

  it('feed filters by q and paginates with a cursor', async () => {
    const account = await createAccount('feed');
    for (let i = 0; i < 3; i += 1) {
      const { id } = await createDraft(account, `${PREFIX}Feed ${i}`);
      await api(account, 'PATCH', `/api/v1/documents/${id}/publish`);
    }

    const first = await api(null, 'GET', `/api/v1/documents?q=${encodeURIComponent(PREFIX)}&limit=1&sort=recent`);
    expect(first.statusCode).toBe(200);
    const firstBody = first.json() as { data: { items: { id: string }[]; nextCursor: string | null; total: number } };
    expect(firstBody.data.total).toBeGreaterThanOrEqual(3);
    expect(firstBody.data.items).toHaveLength(1);
    expect(firstBody.data.nextCursor).toBeTruthy();

    const second = await api(
      null,
      'GET',
      `/api/v1/documents?q=${encodeURIComponent(PREFIX)}&limit=1&sort=recent&cursor=${encodeURIComponent(firstBody.data.nextCursor!)}`
    );
    expect(second.statusCode).toBe(200);
    const secondBody = second.json() as { data: { items: { id: string }[] } };
    expect(secondBody.data.items).toHaveLength(1);
    expect(secondBody.data.items[0]!.id).not.toBe(firstBody.data.items[0]!.id);
  });
});
