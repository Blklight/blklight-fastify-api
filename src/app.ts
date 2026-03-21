import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import scalar from '@scalar/fastify-api-reference';
import { env } from './config/env';
import { AppError, ValidationError } from './utils/errors';
import authRoutes from './features/auth/auth.routes';
import profileRoutes from './features/profiles/profiles.routes';
import documentRoutes from './features/documents/documents.routes';
import styleTemplateRoutes from './features/document-style-templates/document-style-templates.routes';
import tutorialExerciseRoutes from './features/tutorial-exercises/tutorial-exercises.routes';
import likesRoutes from './features/likes/likes.routes';
import bookmarksRoutes from './features/bookmarks/bookmarks.routes';
import categoryRoutes from './features/categories/categories.routes';
import tagRoutes from './features/tags/tags.routes';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      transport:
        env.NODE_ENV === 'development'
          ? {
              target: 'pino-pretty',
              options: { colorize: true },
            }
          : undefined,
    },
  });

  await app.register(swagger, {
    openapi: {
      info: { title: 'blklight API', version: '1.0.0' },
      servers: [{ url: `http://localhost:${env.PORT}` }],
    },
  });

  await app.register(scalar, {
    routePrefix: '/docs',
    configuration: { title: 'blklight API' },
  });

  await app.register(cookie, { parseOptions: {} });

  await app.register(jwt, {
    secret: env.JWT_ACCESS_SECRET,
  });

  await app.register(cors, { origin: env.CORS_ORIGIN, credentials: true });

  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });

  app.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      await request.jwtVerify();
    } catch {
      reply.code(401).send({
        data: null,
        error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
        message: 'Authentication failed',
      });
    }
  });

  app.addHook('onRequest', async (request) => {
    request.log.info({ url: request.url, method: request.method }, 'incoming request');
  });

  app.addHook('onResponse', async (request, reply) => {
    request.log.info({ statusCode: reply.statusCode }, 'request completed');
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, 'request error');

    if (error instanceof ZodError) {
      const fields: Record<string, string> = {};
      for (const issue of error.issues) {
        const path = issue.path.join('.');
        if (!fields[path]) {
          fields[path] = issue.message;
        }
      }
      return reply.code(400).send({
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          fields,
        },
        message: 'Validation failed',
      });
    }

    if (error instanceof ValidationError) {
      return reply.code(400).send({
        data: null,
        error: {
          code: error.code,
          message: error.message,
          fields: error.fields,
        },
        message: 'Validation failed',
      });
    }

    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({
        data: null,
        error: { code: error.code, message: error.message },
        message: error.message,
      });
    }

    return reply.code(500).send({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
      message: 'Internal server error',
    });
  });

  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(profileRoutes, { prefix: '/api/v1/profiles' });
  await app.register(documentRoutes, { prefix: '/api/v1/documents' });
  await app.register(styleTemplateRoutes, { prefix: '/api/v1/document-style-templates' });
  await app.register(tutorialExerciseRoutes, { prefix: '/api/v1' });
  await app.register(likesRoutes, { prefix: '/api/v1' });
  await app.register(bookmarksRoutes, { prefix: '/api/v1' });
  await app.register(categoryRoutes, { prefix: '/api/v1/categories' });
  await app.register(tagRoutes, { prefix: '/api/v1/tags' });

  const startTime = Date.now();
  app.get('/health', async (_request, _reply) => ({
    data: {
      status: 'ok',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString(),
    },
    error: null,
    message: 'Healthy',
  }));

  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export type { FastifyRequest, FastifyReply };
