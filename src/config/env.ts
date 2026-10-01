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

/**
 * Split a comma-separated env value into trimmed, non-empty entries.
 * @param value - Raw env value, e.g. "http://a.com,http://b.com"
 * @returns Array of entries with surrounding whitespace and blanks removed
 */
const splitList = (value: string): string[] =>
  value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

/**
 * Normalize one allowlist entry to a canonical bare origin (scheme://host[:port]).
 * Rejects the wildcard and anything that is not an http(s) origin without path,
 * query, hash or credentials, so @fastify/cors can echo the browser origin back
 * verbatim alongside credentials: true.
 * @param value - Single allowlist entry
 * @returns Canonical origin string, or null when the entry is not usable
 */
const canonicalizeOrigin = (value: string): string | null => {
  if (value === "*") {
    return null;
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }

  if (url.username || url.password) {
    return null;
  }

  if (url.pathname !== "/" || url.search !== "" || url.hash !== "") {
    return null;
  }

  return url.origin;
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
    JWT_REFRESH_REMEMBER_TTL: z.string().default("30d"),
    PORT: z.coerce.number().int().positive().default(4000),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace"])
      .default("info"),
    CORS_ORIGIN: z.string().default("http://localhost:3000"),
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
    ADMIN_EMAIL: z.string().email().optional(),
    ADMIN_PASSWORD: z.string().min(8).optional(),
  })
  .superRefine((data, ctx) => {
    const corsEntries = splitList(data.CORS_ORIGIN);

    if (corsEntries.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["CORS_ORIGIN"],
        message: "CORS_ORIGIN must list at least one origin",
      });
    }

    for (const entry of corsEntries) {
      if (entry === "*") {
        ctx.addIssue({
          code: "custom",
          path: ["CORS_ORIGIN"],
          message:
            'CORS_ORIGIN cannot be "*": wildcard origins are invalid with cookie credentials. List explicit origins instead, e.g. CORS_ORIGIN=http://localhost:3000',
        });
        continue;
      }

      if (canonicalizeOrigin(entry) === null) {
        ctx.addIssue({
          code: "custom",
          path: ["CORS_ORIGIN"],
          message: `Invalid origin "${entry}": use a bare origin with scheme and optional port, without path, query, fragment or credentials (e.g. http://localhost:3000)`,
        });
      }
    }

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

/**
 * Parsed environment plus derived values.
 * CORS_ORIGINS is the canonicalized allowlist; CORS_ORIGIN stays available as
 * the raw string so boot can report the offending value.
 */
type Env = z.infer<typeof envSchema> & {
  /** Canonical origins allowed by @fastify/cors. Never contains "*". */
  CORS_ORIGINS: string[];
};

export const env: Env = {
  ...parsed.data,
  // Validation above guarantees every entry is canonical, so nulls cannot occur.
  CORS_ORIGINS: splitList(parsed.data.CORS_ORIGIN)
    .map(canonicalizeOrigin)
    .filter((origin): origin is string => origin !== null),
};
