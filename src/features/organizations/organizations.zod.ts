import { z } from 'zod';

const orgnameSchema = z
  .string()
  .min(3, 'Orgname must be at least 3 characters')
  .max(30, 'Orgname must be at most 30 characters')
  .regex(/^[a-zA-Z0-9_]+$/, 'Orgname can only contain letters, numbers, and underscores')
  .trim()
  .transform((value) => value.toLowerCase());

export const createOrganizationSchema = z.object({
  name: z.string().min(1, 'Organization name is required').max(100).trim(),
  orgname: orgnameSchema,
  description: z.string().max(500).trim().nullable().optional(),
  isPrivate: z.boolean().default(false).optional(),
});

export const inviteMemberSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required'),
});

export const decideMembershipSchema = z.object({
  decision: z.enum(['accepted', 'rejected']),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type DecideMembershipInput = z.infer<typeof decideMembershipSchema>;