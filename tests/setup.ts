import { vi } from 'vitest';

vi.mock('../src/config/env', () => ({
  env: {
    DATABASE_URL: 'postgres://test:test@localhost:5432/test',
    JWT_ACCESS_SECRET: 'test-access-secret-minimum-32-chars',
    JWT_REFRESH_SECRET: 'test-refresh-secret-minimum-32-chars',
    JWT_ACCESS_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
    PORT: 3000,
    NODE_ENV: 'test',
    LOG_LEVEL: 'error',
    CORS_ORIGIN: '*',
    MAX_SESSIONS_PER_USER: 5,
    SIGNATURE_ENCRYPTION_KEY: '0'.repeat(64),
    GITHUB_CLIENT_ID: 'test',
    GITHUB_CLIENT_SECRET: 'test',
    GOOGLE_CLIENT_ID: 'test',
    GOOGLE_CLIENT_SECRET: 'test',
    OAUTH_REDIRECT_BASE_URL: 'http://localhost:3000',
    FRONTEND_URL: 'http://localhost:5173',
  },
}));
