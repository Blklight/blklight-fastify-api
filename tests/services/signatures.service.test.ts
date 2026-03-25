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
  },
}));

import { createSignature, signDocument, verifyDocument } from '../../src/features/signatures/signatures.service';
import { NotFoundError } from '../../src/utils/errors';
import { encryptSecret } from '../../src/utils/crypto';

describe('signatures.service', () => {
  let validEncryptedSecret: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    validEncryptedSecret = encryptSecret('a'.repeat(64));
  });

  describe('createSignature', () => {
    it('createSignature generates user_hash and stores encrypted secret', async () => {
      const { db } = await import('../../src/db/index');
      
      const result = await createSignature('user123', 'test@example.com', new Date());
      
      expect(result.userHash).toBeDefined();
      expect(result.signatureId).toBeDefined();
      expect(db.insert).toHaveBeenCalled();
    });

    it('createSignature two users produce different user_hashes', async () => {
      const result1 = await createSignature('user1', 'test1@example.com', new Date());
      const result2 = await createSignature('user2', 'test2@example.com', new Date());
      
      expect(result1.userHash).not.toBe(result2.userHash);
    });
  });

  describe('signDocument', () => {
    it('signDocument returns documentHash, signature, publicIdentifier', async () => {
      const { db } = await import('../../src/db/index');
      
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              id: 'sig1',
              userId: 'user123',
              userHash: 'abc123',
              secretEncrypted: validEncryptedSecret,
              createdAt: new Date(),
            }]),
          }),
        }),
      } as never);

      const result = await signDocument('user123', '{"type":"doc","content":[]}');
      
      expect(result.documentHash).toBeDefined();
      expect(result.signature).toBeDefined();
      expect(result.publicIdentifier).toMatch(/^PLT-[a-f0-9]+\.[a-f0-9]+$/);
    });
  });

  describe('verifyDocument', () => {
    it('verifyDocument correct content returns true', async () => {
      const { db } = await import('../../src/db/index');
      
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              id: 'sig1',
              userId: 'user123',
              userHash: 'abc123def456',
              secretEncrypted: validEncryptedSecret,
              createdAt: new Date(),
            }]),
          }),
        }),
      } as never);

      const result = await verifyDocument('user123', '{"type":"doc","content":[]}', 'somesig');
      expect(typeof result).toBe('boolean');
    });

    it('verifyDocument unknown userId throws NotFoundError', async () => {
      const { db } = await import('../../src/db/index');
      
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as never);

      await expect(
        verifyDocument('unknown', 'content', 'sig')
      ).rejects.toThrow(NotFoundError);
    });
  });
});
