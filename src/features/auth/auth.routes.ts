import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index';
import { registerSchema, loginSchema } from './auth.zod';
import { registerUser, loginUser, refreshSession, logout, buildAuthSession, getOnboardingStep } from './auth.service';
import { users } from './auth.schema';
import { verifyEmail, sendVerificationEmail, sendPasswordResetEmail, resetPassword } from '../email/email.service';
import { requireFeature } from '../../config/features';
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

    const authSession = await buildAuthSession(user.id, accessToken);

    const maxAge = parseRefreshMaxAge(env.JWT_REFRESH_EXPIRES_IN);
    reply.code(201).setCookie('refreshToken', refreshToken, buildCookieOptions(maxAge)).send({
      data: authSession,
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
      summary: 'Login with email or username',
      tags: ['auth'],
      body: {
        type: 'object',
        required: ['identifier', 'password'],
        properties: {
          identifier: { type: 'string', minLength: 1 },
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

    const { identifier, password } = parsed.data;
    const { userId, refreshToken } = await loginUser(identifier, password);

    const accessToken = app.jwt.sign(
      { userId, email: '', role: 'user' },
      { expiresIn: env.JWT_ACCESS_EXPIRES_IN }
    );

    const authSession = await buildAuthSession(userId, accessToken);

    const maxAge = parseRefreshMaxAge(env.JWT_REFRESH_EXPIRES_IN);
    reply.setCookie('refreshToken', refreshToken, buildCookieOptions(maxAge)).send({
      data: authSession,
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

    const authSession = await buildAuthSession(user.id, accessToken);

    reply.send({
      data: authSession,
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

  app.get('/onboarding/status', {
    preHandler: [(request: FastifyRequest, reply: FastifyReply) => app.authenticate(request, reply)],
    schema: {
      summary: 'Get onboarding status',
      tags: ['auth'],
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                step: { type: 'string' },
                user: { type: 'object' },
                profile: { type: 'object' },
                apps: { type: 'array' },
              },
            },
            error: { type: 'null' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user.userId;

    const [userRow] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userRow) {
      return reply.code(404).send({
        data: null,
        error: { code: 'NOT_FOUND', message: 'User not found' },
        message: 'User not found',
      });
    }

    const dummyToken = '';
    const authSession = await buildAuthSession(userId, dummyToken);
    const step = getOnboardingStep({
      username: userRow.username,
      onboardingComplete: userRow.onboardingComplete,
    });

    reply.send({
      data: { step, ...authSession },
      error: null,
      message: 'Onboarding status retrieved',
    });
  });

  app.post('/verify-email', {
    schema: {
      summary: 'Verify email address',
      tags: ['auth'],
      body: {
        type: 'object',
        required: ['token'],
        properties: {
          token: { type: 'string' },
        },
      },
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
    requireFeature('email');

    const parsed = z.object({ token: z.string() }).safeParse(request.body);
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

    await verifyEmail(parsed.data.token);

    reply.send({
      data: null,
      error: null,
      message: 'Email verified successfully',
    });
  });

  app.post('/resend-verification', {
    preHandler: [(request: FastifyRequest, reply: FastifyReply) => app.authenticate(request, reply)],
    config: {
      rateLimit: {
        max: 3,
        timeWindow: '1 hour',
      },
    },
    schema: {
      summary: 'Resend verification email',
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
    requireFeature('email');

    const userId = request.user.userId;
    const { users } = await import('../auth/auth.schema');
    const { db } = await import('../../db/index');
    const { eq } = await import('drizzle-orm');

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return reply.code(404).send({
        data: null,
        error: { code: 'NOT_FOUND', message: 'User not found' },
        message: 'User not found',
      });
    }

    await sendVerificationEmail(user.id, user.email, user.username);

    reply.send({
      data: null,
      error: null,
      message: 'Verification email queued',
    });
  });

  app.post('/forgot-password', {
    config: {
      rateLimit: {
        max: 3,
        timeWindow: '1 hour',
      },
    },
    schema: {
      summary: 'Request password reset',
      tags: ['auth'],
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email' },
        },
      },
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
    requireFeature('email');

    const parsed = z.object({ email: z.string().email() }).safeParse(request.body);
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

    await sendPasswordResetEmail(parsed.data.email);

    reply.send({
      data: null,
      error: null,
      message: 'If this email exists, a reset link has been queued',
    });
  });

  app.post('/reset-password', {
    schema: {
      summary: 'Reset password',
      tags: ['auth'],
      body: {
        type: 'object',
        required: ['token', 'password'],
        properties: {
          token: { type: 'string' },
          password: { type: 'string', minLength: 8, maxLength: 128 },
        },
      },
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
    requireFeature('email');

    const parsed = z.object({
      token: z.string(),
      password: z.string().min(8).max(128),
    }).safeParse(request.body);

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

    await resetPassword(parsed.data.token, parsed.data.password);

    reply.send({
      data: null,
      error: null,
      message: 'Password reset successfully. Please log in again.',
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
