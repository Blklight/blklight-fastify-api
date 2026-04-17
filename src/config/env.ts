import { z } from "zod";
import { config } from "dotenv";
import { expand } from "dotenv-expand";
import { resolve } from "node:path";

const nodeEnv = process.env.NODE_ENV ?? "development";
expand(config({ path: resolve(process.cwd(), `.env.${nodeEnv}`) }));
expand(config({ path: resolve(process.cwd(), ".env"), override: false }));

const booleanFromEnvDefault = (defaultValue: boolean) => {
  const stringOrBool = z.union([
    z.string().transform((val) => val === 'true' || val === '1'),
    z.boolean(),
  ]);
  return stringOrBool.default(defaultValue);
};

const envSchema = z
  .object({
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    JWT_ACCESS_SECRET: z
      .string()
      .min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
    JWT_REFRESH_SECRET: z
      .string()
      .min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
    JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
    JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
    PORT: z.coerce.number().int().positive().default(4000),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace"])
      .default("info"),
    CORS_ORIGIN: z.string().default("*"),
    MAX_SESSIONS_PER_USER: z.coerce.number().int().positive().default(5),
    SIGNATURE_ENCRYPTION_KEY: z.string().min(64).optional(),
    GITHUB_CLIENT_ID: z.string().min(1).optional(),
    GITHUB_CLIENT_SECRET: z.string().min(1).optional(),
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
    OAUTH_REDIRECT_BASE_URL: z.string().url().optional(),
    FRONTEND_URL: z.string().url().optional(),
    RESEND_API_KEY: z.string().min(1).optional(),
    EMAIL_FROM: z.string().default("onboarding@resend.dev"),
    EMAIL_DAILY_LIMIT: z.coerce.number().default(50),
    EMAIL_VERIFY_EXPIRES_IN_HOURS: z.coerce.number().default(24),
    PASSWORD_RESET_EXPIRES_IN_MINUTES: z.coerce.number().default(30),
    FEATURE_EMAIL: booleanFromEnvDefault(false),
    FEATURE_OAUTH: booleanFromEnvDefault(false),
    FEATURE_EMAIL_QUEUE: booleanFromEnvDefault(false),
    FEATURE_CODE_SANDBOX: booleanFromEnvDefault(true),
    FEATURE_MEMORY: booleanFromEnvDefault(true),
    GEMINI_API_KEY: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.FEATURE_OAUTH) {
      const oauthFields = [
        "GITHUB_CLIENT_ID",
        "GITHUB_CLIENT_SECRET",
        "GOOGLE_CLIENT_ID",
        "GOOGLE_CLIENT_SECRET",
        "OAUTH_REDIRECT_BASE_URL",
      ];
      for (const field of oauthFields) {
        if (!data[field as keyof typeof data]) {
          ctx.addIssue({
            code: "custom",
            path: [field],
            message: `Required when FEATURE_OAUTH=true`,
          });
        }
      }
    }

    if (data.FEATURE_EMAIL) {
      const emailFields = ["RESEND_API_KEY", "FRONTEND_URL"];
      for (const field of emailFields) {
        if (!data[field as keyof typeof data]) {
          ctx.addIssue({
            code: "custom",
            path: [field],
            message: `Required when FEATURE_EMAIL=true`,
          });
        }
      }
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const errors = parsed.error.issues
    .map((e) => `${e.path.join(".")}: ${e.message}`)
    .join(", ");
  console.error("❌ Invalid environment variables:", errors);
  process.exit(1);
}

export const env = parsed.data satisfies z.infer<typeof envSchema>;
