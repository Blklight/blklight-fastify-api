import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .refine((pwd) => /[A-Z]/.test(pwd), {
    message: 'Password must contain at least one uppercase letter',
  })
  .refine((pwd) => /[0-9]/.test(pwd), {
    message: 'Password must contain at least one number',
  })
  .refine((pwd) => /[!@#$%^&*]/.test(pwd), {
    message: 'Password must contain at least one special character (!@#$%^&*)',
  });

export const registerSchema = z.object({
  email: z.string().email('Invalid email address').transform((e) => e.toLowerCase().trim()),
  username: z.string().min(3, 'Username must be at least 3 characters').max(30, 'Username must be at most 30 characters').trim(),
  password: passwordSchema,
});

export const loginSchema = z.object({
  identifier: z.string().min(1, 'Email or username is required'),
  password: z.string().min(1, 'Password is required'),
});

export const authSessionUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  username: z.string(),
  role: z.enum(['user', 'admin']),
  emailVerified: z.boolean(),
  onboardingComplete: z.boolean(),
  createdAt: z.string(),
});

export const authSessionProfileSchema = z.object({
  id: z.string(),
  userId: z.string(),
  username: z.string(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  isPrivate: z.boolean(),
});

export const authSessionSchema = z.object({
  accessToken: z.string(),
  user: authSessionUserSchema,
  profile: authSessionProfileSchema,
  apps: z.array(z.string()),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type AuthSession = z.infer<typeof authSessionSchema>;
export type AuthSessionUser = z.infer<typeof authSessionUserSchema>;
export type AuthSessionProfile = z.infer<typeof authSessionProfileSchema>;
