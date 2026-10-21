import { z } from 'zod';
import { usernameSchema } from '../../utils/username';

const socialLinksSchema = z.object({
  twitter: z.string().optional(),
  github: z.string().optional(),
  linkedin: z.string().optional(),
  website: z.string().optional(),
}).optional().nullable();

export const updateProfileSchema = z.object({
  username: usernameSchema.optional(),
  displayName: z.string().max(50).nullable().optional(),
  bio: z.string().max(300).nullable().optional(),
  bioPrivate: z.string().max(150).nullable().optional(),
  avatarUrl: z.string().url('Invalid URL format').nullable().optional(),
  socialLinks: socialLinksSchema,
  isPrivate: z.boolean().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
