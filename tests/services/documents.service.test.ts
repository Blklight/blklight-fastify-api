import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  dbUpdateSets: [] as unknown[],
  txInsertValues: [] as unknown[],
  txUpdateSets: [] as unknown[],
}));

vi.mock('../../src/db/index', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
    update: vi.fn().mockImplementation(() => ({
      set: vi.fn().mockImplementation((values: unknown) => {
        h.dbUpdateSets.push(values);
        return { where: vi.fn().mockResolvedValue(undefined) };
      }),
    })),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
    transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        insert: vi.fn().mockImplementation(() => ({
          values: vi.fn().mockImplementation((values: unknown) => {
            h.txInsertValues.push(values);
            return Promise.resolve(undefined);
          }),
        })),
        select: vi.fn(),
        update: vi.fn().mockImplementation(() => ({
          set: vi.fn().mockImplementation((values: unknown) => {
            h.txUpdateSets.push(values);
            return { where: vi.fn().mockResolvedValue(undefined) };
          }),
        })),
        delete: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      };
      return fn(tx);
    }),
  },
}));

vi.mock('../../src/features/signatures/signatures.service', () => ({
  signDocument: vi.fn().mockResolvedValue({
    documentHash: 'dochash',
    signature: 'sig',
    publicIdentifier: 'PLT-abc.defg',
    userHash: 'userhash',
  }),
}));

vi.mock('../../src/features/categories/categories.service', () => ({
  setDocumentCategory: vi.fn().mockResolvedValue(undefined),
  removeDocumentCategory: vi.fn().mockResolvedValue(undefined),
  getDocumentCategory: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../src/features/tags/tags.service', () => ({
  setDocumentTags: vi.fn().mockResolvedValue(undefined),
  getDocumentTags: vi.fn().mockResolvedValue([]),
}));

import { db } from '../../src/db/index';
import {
  createDocument,
  publishDocument,
  updateDocument,
  softDeleteDocument,
} from '../../src/features/documents/documents.service';
import { getDocumentCategory } from '../../src/features/categories/categories.service';
import { ValidationError } from '../../src/utils/errors';

/**
 * Minimal chainable stand-in for a Drizzle select builder. `db.select()`
 * is called for several unrelated queries inside a single service call
 * (type lookup, slug availability, document fetch, style fetch), so tests
 * queue the result of each call in order instead of relying on a single
 * return value for the whole chain.
 */
function makeSelectChain(result: unknown[]): Record<string, unknown> {
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.innerJoin = () => chain;
  chain.leftJoin = () => chain;
  chain.where = () => chain;
  chain.orderBy = () => chain;
  chain.offset = () => chain;
  chain.limit = () => Promise.resolve(result);
  chain.then = (resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
}

function queueSelectResults(...results: unknown[][]): void {
  let call = 0;
  vi.mocked(db.select).mockImplementation(() => {
    const result = results[call] ?? [];
    call += 1;
    return makeSelectChain(result) as never;
  });
}

const draftDocument = {
  id: 'doc1',
  authorId: 'author1',
  typeId: 'type1',
  typeName: 'article',
  status: 'draft',
  title: 'Test Document',
  abstract: null,
  content: { type: 'doc', content: [{ type: 'paragraph' }] },
  coverImageUrl: null,
  slug: 'test-document',
  authorship: null,
  publishedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const publishedDocument = {
  ...draftDocument,
  status: 'published',
  authorship: {
    authorName: 'Author',
    username: 'author',
    userHash: 'userhash',
    documentHash: 'dochash',
    publicIdentifier: 'PLT-abc.defg',
    hmac: 'sig',
    signedAt: '2026-01-01T00:00:00.000Z',
  },
  publishedAt: new Date(),
};

describe('documents.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.dbUpdateSets.length = 0;
    h.txInsertValues.length = 0;
    h.txUpdateSets.length = 0;
    vi.mocked(getDocumentCategory).mockResolvedValue(null);
    queueSelectResults();
  });

  describe('createDocument', () => {
    it('createDocument inserts document + styles in transaction', async () => {
      queueSelectResults([{ id: 'type1', name: 'article' }], [], [draftDocument], []);

      const result = await createDocument('author1', {
        title: 'Test Document',
        type: 'article',
      });

      expect(result.id).toBe('doc1');
      expect(db.transaction).toHaveBeenCalled();

      const [documentInsert, styleInsert] = h.txInsertValues as Array<Record<string, unknown>>;
      expect(documentInsert.slug).toBe('test-document');
      expect(documentInsert.status).toBe('draft');
      expect(documentInsert.authorId).toBe('author1');
      expect(styleInsert.documentId).toBe(documentInsert.id);
    });

    it('createDocument auto-generates slug from title', async () => {
      queueSelectResults([{ id: 'type1', name: 'article' }], [], [draftDocument], []);

      await createDocument('author1', {
        title: 'My Test Document',
        type: 'article',
      });

      const [documentInsert] = h.txInsertValues as Array<Record<string, unknown>>;
      expect(documentInsert.slug).toBe('my-test-document');
    });
  });

  describe('publishDocument', () => {
    it('publishDocument without category throws ValidationError', async () => {
      queueSelectResults([draftDocument]);

      await expect(publishDocument('author1', 'doc1')).rejects.toThrow(ValidationError);
    });

    it('publishDocument empty content throws ValidationError', async () => {
      queueSelectResults([{ ...draftDocument, content: null }]);

      await expect(publishDocument('author1', 'doc1')).rejects.toThrow(ValidationError);
    });

    it('publishDocument sets status, authorship and publishedAt', async () => {
      vi.mocked(getDocumentCategory).mockResolvedValue({
        id: 'cat1',
        name: 'Category',
        slug: 'category',
      } as never);
      queueSelectResults(
        [draftDocument],
        [{ id: 'author1', userId: 'user1', username: 'author', displayName: null }],
        [publishedDocument],
        []
      );

      const result = await publishDocument('author1', 'doc1');

      expect(result.status).toBe('published');
      const update = h.dbUpdateSets[0] as Record<string, unknown>;
      expect(update.status).toBe('published');
      expect(update.authorship).toMatchObject({
        documentHash: 'dochash',
        publicIdentifier: 'PLT-abc.defg',
      });
      expect(update.publishedAt).toBeInstanceOf(Date);
    });
  });

  describe('updateDocument', () => {
    it('content edit on published preserves status and authorship', async () => {
      queueSelectResults([publishedDocument], [publishedDocument], []);

      const result = await updateDocument('author1', 'doc1', {
        content: { type: 'doc', content: [{ type: 'paragraph', content: [] }] },
      });

      expect(result.status).toBe('published');
      const update = h.txUpdateSets[0] as Record<string, unknown>;
      expect(update.content).toBeDefined();
      expect(update).not.toHaveProperty('status');
      expect(update).not.toHaveProperty('authorship');
    });
  });

  describe('softDeleteDocument', () => {
    it('softDeleteDocument sets deleted_at', async () => {
      queueSelectResults([{ id: 'doc1', authorId: 'author1' }]);

      await softDeleteDocument('author1', 'doc1');

      expect(db.update).toHaveBeenCalled();
      const update = h.dbUpdateSets[0] as Record<string, unknown>;
      expect(update.deletedAt).toBeInstanceOf(Date);
    });
  });
});
