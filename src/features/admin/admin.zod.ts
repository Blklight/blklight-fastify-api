import { z } from 'zod';

export const listUsersQuerySchema = z.object({
  search: z.string().optional(),
  role: z.enum(['user', 'admin']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  deleted: z.enum(['true', 'false']).default('false'),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

export const updateRoleSchema = z.object({
  role: z.enum(['user', 'admin']),
});

export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
