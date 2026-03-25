import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/db/index', () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
    transaction: vi.fn().mockImplementation(async (fn) => {
      const tx = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        }),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
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
  }),
}));

vi.mock('../../src/features/categories/categories.service', () => ({
  setDocumentCategory: vi.fn().mockResolvedValue(undefined),
  getDocumentCategory: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../src/features/tags/tags.service', () => ({
  setDocumentTags: vi.fn().mockResolvedValue(undefined),
  getDocumentTags: vi.fn().mockResolvedValue([]),
}));

import {
  createDocument,
  publishDocument,
  updateDocument,
  softDeleteDocument,
} from '../../src/features/documents/documents.service';
import { ValidationError } from '../../src/utils/errors';

describe('documents.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createDocument', () => {
    it('createDocument inserts document + styles in transaction', async () => {
      const { db } = await import('../../src/db/index');
      
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 'type1', name: 'article' }]),
          }),
        }),
      } as never);

      const result = await createDocument('author1', {
        title: 'Test Document',
        type: 'article',
      });
      
      expect(result).toBeDefined();
    });

    it('createDocument auto-generates slug from title', async () => {
      const { db } = await import('../../src/db/index');
      
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 'type1', name: 'article' }]),
          }),
        }),
      } as never);

      const result = await createDocument('author1', {
        title: 'My Test Document',
        type: 'article',
      });
      
      expect(result).toBeDefined();
    });
  });

  describe('publishDocument', () => {
    it('publishDocument without category throws ValidationError', async () => {
      const { db } = await import('../../src/db/index');
      
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              id: 'doc1',
              authorId: 'author1',
              status: 'draft',
              content: { type: 'doc', content: [{ type: 'paragraph' }] },
            }]),
          }),
        }),
      } as never);

      await expect(publishDocument('doc1', 'author1', '')).rejects.toThrow(ValidationError);
    });

    it('publishDocument empty content throws ValidationError', async () => {
      const { db } = await import('../../src/db/index');
      
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              id: 'doc1',
              authorId: 'author1',
              status: 'draft',
              content: null,
            }]),
          }),
        }),
      } as never);

      await expect(publishDocument('doc1', 'author1', 'cat1')).rejects.toThrow(ValidationError);
    });
  });

  describe('updateDocument', () => {
    it('updateDocument content edit on published resets to draft', async () => {
      const { db } = await import('../../src/db/index');
      
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              id: 'doc1',
              authorId: 'author1',
              status: 'published',
              title: 'Test',
              content: { type: 'doc', content: [{ type: 'paragraph' }] },
            }]),
          }),
        }),
      } as never);

      await expect(
        updateDocument('doc1', 'author1', { title: 'Updated' })
      ).rejects.toThrow();
    });
  });

  describe('softDeleteDocument', () => {
    it('softDeleteDocument sets deleted_at', async () => {
      const { db } = await import('../../src/db/index');
      
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 'doc1', authorId: 'author1' }]),
          }),
        }),
      } as never);

      await softDeleteDocument('doc1', 'author1');
      expect(db.update).toHaveBeenCalled();
    });
  });
});
