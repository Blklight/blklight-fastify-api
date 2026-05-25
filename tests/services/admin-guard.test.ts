import { describe, it, expect } from 'vitest';
import { requireAdmin } from '../../src/hooks/admin-guard';
import { ForbiddenError } from '../../src/utils/errors';

describe('adminGuard', () => {
  it('requireAdmin passes for admin role', async () => {
    const request = { user: { role: 'admin' } } as any;
    const reply = {} as any;

    await expect(requireAdmin(request, reply)).resolves.toBeUndefined();
  });

  it('requireAdmin throws ForbiddenError for non-admin role', async () => {
    const request = { user: { role: 'user' } } as any;
    const reply = {} as any;

    await expect(requireAdmin(request, reply)).rejects.toThrow(ForbiddenError);
  });

  it('requireAdmin throws ForbiddenError when user is undefined', async () => {
    const request = { user: undefined } as any;
    const reply = {} as any;

    await expect(requireAdmin(request, reply)).rejects.toThrow(ForbiddenError);
  });
});
