import { z } from 'zod';

const socialLinksSchema = z.object({
  twitter: z.string().optional(),
  github: z.string().optional(),
  linkedin: z.string().optional(),
  website: z.string().optional(),
}).optional().nullable();

export const updateProfileSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .optional(),
  displayName: z.string().max(50).nullable().optional(),
  bio: z.string().max(300).nullable().optional(),
  avatarUrl: z.string().url('Invalid URL format').nullable().optional(),
  socialLinks: socialLinksSchema,
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
