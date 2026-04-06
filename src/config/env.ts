import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  CORS_ORIGIN: z.string().default('*'),
  MAX_SESSIONS_PER_USER: z.coerce.number().int().positive().default(5),
  SIGNATURE_ENCRYPTION_KEY: z.string().min(64, 'SIGNATURE_ENCRYPTION_KEY must be 64 hex characters (32 bytes)'),
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  OAUTH_REDIRECT_BASE_URL: z.string().url(),
  FRONTEND_URL: z.string().url(),
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().default('onboarding@resend.dev'),
  EMAIL_DAILY_LIMIT: z.coerce.number().default(50),
  EMAIL_VERIFY_EXPIRES_IN_HOURS: z.coerce.number().default(24),
  PASSWORD_RESET_EXPIRES_IN_MINUTES: z.coerce.number().default(30),
  FEATURE_EMAIL: z.coerce.boolean().default(false),
  FEATURE_OAUTH: z.coerce.boolean().default(false),
  FEATURE_EMAIL_QUEUE: z.coerce.boolean().default(false),
  FEATURE_CODE_SANDBOX: z.coerce.boolean().default(true),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const errors = parsed.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
  console.error('❌ Invalid environment variables:', errors);
  process.exit(1);
}

export const env = parsed.data satisfies z.infer<typeof envSchema>;
