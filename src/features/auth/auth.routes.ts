import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { registerSchema, loginSchema } from './auth.zod';
import { registerUser, loginUser, refreshSession, logout } from './auth.service';
import { env } from '../../config/env';

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
};

function buildCookieOptions(maxAge?: number) {
  return {
    ...REFRESH_COOKIE_OPTIONS,
    ...(maxAge ? { maxAge } : {}),
  };
}

export default async function authRoutes(app: FastifyInstance) {
  app.post('/register', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '1 minute',
      },
    },
    schema: {
      summary: 'Register a new user',
      tags: ['auth'],
      body: {
        type: 'object',
        required: ['email', 'username', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          username: { type: 'string', minLength: 3, maxLength: 30 },
          password: { type: 'string' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                user: { type: 'object' },
                accessToken: { type: 'string' },
              },
            },
            error: { type: 'null' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          fields: Object.fromEntries(
            parsed.error.issues.map((i) => [i.path.join('.'), i.message])
          ),
        },
        message: 'Validation failed',
      });
    }

    const { email, username, password } = parsed.data;
    const { user, refreshToken } = await registerUser(email, username, password);

    const accessToken = app.jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      { expiresIn: env.JWT_ACCESS_EXPIRES_IN }
    );

    const maxAge = parseRefreshMaxAge(env.JWT_REFRESH_EXPIRES_IN);
    reply.code(201).setCookie('refreshToken', refreshToken, buildCookieOptions(maxAge)).send({
      data: { user, accessToken },
      error: null,
      message: 'User registered successfully',
    });
  });

  app.post('/login', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute',
      },
    },
    schema: {
      summary: 'Login with email and password',
      tags: ['auth'],
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                user: { type: 'object' },
                accessToken: { type: 'string' },
              },
            },
            error: { type: 'null' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          fields: Object.fromEntries(
            parsed.error.issues.map((i) => [i.path.join('.'), i.message])
          ),
        },
        message: 'Validation failed',
      });
    }

    const { email, password } = parsed.data;
    const { user, refreshToken } = await loginUser(email, password);

    const accessToken = app.jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      { expiresIn: env.JWT_ACCESS_EXPIRES_IN }
    );

    const maxAge = parseRefreshMaxAge(env.JWT_REFRESH_EXPIRES_IN);
    reply.setCookie('refreshToken', refreshToken, buildCookieOptions(maxAge)).send({
      data: { user, accessToken },
      error: null,
      message: 'Login successful',
    });
  });

  app.post('/refresh', {
    schema: {
      summary: 'Refresh access token',
      tags: ['auth'],
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                accessToken: { type: 'string' },
              },
            },
            error: { type: 'null' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const refreshToken = request.cookies.refreshToken;
    if (!refreshToken) {
      return reply.code(401).send({
        data: null,
        error: { code: 'UNAUTHORIZED', message: 'Refresh token required' },
        message: 'Authentication required',
      });
    }

    const user = await refreshSession(refreshToken);
    const accessToken = app.jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      { expiresIn: env.JWT_ACCESS_EXPIRES_IN }
    );

    reply.send({
      data: { accessToken },
      error: null,
      message: 'Token refreshed',
    });
  });

  app.post('/logout', {
    schema: {
      summary: 'Logout and invalidate refresh token',
      tags: ['auth'],
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'null' },
            error: { type: 'null' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const refreshToken = request.cookies.refreshToken;
    if (refreshToken) {
      await logout(refreshToken);
    }

    reply.clearCookie('refreshToken', REFRESH_COOKIE_OPTIONS).send({
      data: null,
      error: null,
      message: 'Logged out successfully',
    });
  });
}

function parseRefreshMaxAge(expiresIn: string): number {
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match || !match[1] || !match[2]) {
    return 7 * 24 * 60 * 60;
  }
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return value * (multipliers[unit] ?? 86400);
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
