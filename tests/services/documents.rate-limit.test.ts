import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

// The routes query profiles directly through db before calling the service.
// A stub keeps the rate-limit tests free of a database while still exercising
// the real route registration (and therefore the real config.rateLimit).
vi.mock('../../src/db/index', () => {
  const select = () => ({
    from: () => ({
      where: () => ({
        limit: async () => [{ id: 'profile-1' }],
      }),
    }),
  });
  return { db: { select } };
});

vi.mock('../../src/features/documents/documents.service', () => ({
  createDocument: vi.fn(async () => ({ id: 'doc-1' })),
  updateDocument: vi.fn(async () => ({ id: 'doc-1' })),
  publishDocument: vi.fn(async () => ({ id: 'doc-1' })),
  softDeleteDocument: vi.fn(async () => undefined),
  getMyDocuments: vi.fn(async () => []),
  getMyDocumentById: vi.fn(async () => ({ id: 'doc-1' })),
  getPublicFeed: vi.fn(async () => ({ items: [], nextCursor: null })),
  getPublicDocument: vi.fn(async () => ({ id: 'doc-1' })),
}));

// Small limits so the N+1 assertion is cheap. tests/setup.ts sets them high for
// the rest of the suite; this file overrides them locally.
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
      LOG_LEVEL: 'error',
      FEATURE_OAUTH: false,
      FEATURE_EMAIL: false,
      FEATURE_MEMORY: false,
      RATE_LIMIT_DOCS_CREATE_MAX: 2,
      RATE_LIMIT_DOCS_PUBLISH_MAX: 1,
    },
  };
});

import { buildApp } from '../../src/app';

const CREATE_MAX = 2;
const PUBLISH_MAX = 1;

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

/** Signs a real access token with the app's own JWT secret. */
function bearer(userId: string): string {
  return `Bearer ${app.jwt.sign({ userId, email: `${userId}@test.local`, role: 'user' })}`;
}

function createDoc(userId: string, remoteAddress = '10.0.0.1') {
  return app.inject({
    method: 'POST',
    url: '/api/v1/documents/',
    headers: { authorization: bearer(userId) },
    payload: { title: 'Rate limited', type: 'article' },
    remoteAddress,
  });
}

function publishDoc(userId: string, docId: string, remoteAddress = '10.0.0.2') {
  return app.inject({
    method: 'PATCH',
    url: `/api/v1/documents/${docId}/publish`,
    headers: { authorization: bearer(userId) },
    remoteAddress,
  });
}

function autosaveDoc(userId: string, docId: string, remoteAddress = '10.0.0.3') {
  return app.inject({
    method: 'PATCH',
    url: `/api/v1/documents/${docId}`,
    headers: { authorization: bearer(userId) },
    payload: { title: 'Autosave' },
    remoteAddress,
  });
}

describe('documents create/publish rate limit', () => {
  it('returns the standard envelope on the (N+1)th create for the same user', async () => {
    const user = 'rate-create-user';

    for (let i = 1; i <= CREATE_MAX; i++) {
      const res = await createDoc(user);
      expect(res.statusCode).toBe(201);
    }

    const limited = await createDoc(user);
    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toEqual({
      data: null,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: expect.any(String),
      },
      message: expect.any(String),
    });
    expect(limited.headers['x-ratelimit-limit']).toBe(String(CREATE_MAX));
    expect(limited.headers['x-ratelimit-remaining']).toBe('0');
    expect(limited.headers['retry-after']).toBeDefined();
  });

  it('returns the standard envelope on the (N+1)th publish for the same user', async () => {
    const user = 'rate-publish-user';

    const first = await publishDoc(user, 'doc-publish-1');
    expect(first.statusCode).toBe(200);

    const limited = await publishDoc(user, 'doc-publish-2');
    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toEqual({
      data: null,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: expect.any(String),
      },
      message: expect.any(String),
    });
    expect(limited.headers['x-ratelimit-limit']).toBe(String(PUBLISH_MAX));
    expect(limited.headers['retry-after']).toBeDefined();
  });

  it('does not let one user exhaust another user budget', async () => {
    const noisy = 'rate-sharing-noisy';
    for (let i = 1; i <= CREATE_MAX; i++) {
      expect((await createDoc(noisy)).statusCode).toBe(201);
    }
    expect((await createDoc(noisy)).statusCode).toBe(429);

    const quiet = 'rate-sharing-quiet';
    const quietRes = await createDoc(quiet);
    expect(quietRes.statusCode).toBe(201);
    expect(quietRes.headers['x-ratelimit-remaining']).toBe(String(CREATE_MAX - 1));
  });

  it('keeps the autosave PATCH route free of the new per-route limit', async () => {
    const user = 'rate-autosave-user';

    for (let i = 0; i < 40; i++) {
      const res = await autosaveDoc(user, 'doc-autosave');
      expect(res.statusCode).toBe(200);
    }
  });
});
