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
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
    transaction: vi.fn().mockImplementation(async (fn) => {
      const tx = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        }),
      };
      return fn(tx);
    }),
  },
}));

vi.mock('../../src/features/signatures/signatures.service', () => ({}));
vi.mock('../../src/features/profiles/profiles.service', () => ({}));

import { createUser, logout } from '../../src/features/auth/auth.service';
import { ConflictError, UnauthorizedError } from '../../src/utils/errors';

describe('auth.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createUser', () => {
    it('createUser duplicate email throws ConflictError', async () => {
      const { db } = await import('../../src/db/index');
      
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 'existing' }]),
          }),
        }),
      } as never);

      await expect(
        createUser('test@example.com', 'testuser', 'password123')
      ).rejects.toThrow(ConflictError);
    });

    it('createUser duplicate username throws ConflictError', async () => {
      const { db } = await import('../../src/db/index');
      
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as never);

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 'existing' }]),
          }),
        }),
      } as never);

      await expect(
        createUser('test@example.com', 'existinguser', 'password123')
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('logout', () => {
    it('logout deletes session row', async () => {
      const { db } = await import('../../src/db/index');
      
      await logout('refresh-token');
      expect(db.delete).toHaveBeenCalled();
    });
  });
});
